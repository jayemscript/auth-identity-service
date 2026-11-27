import {
  api,
  appHeaders,
  cleanupTrackedUsers,
  readE2EConfig,
  trackUserEmail,
  uniqueUser,
  withVerifiedEmail,
  withDatabase,
} from './support';

describe('self-service sessions and app access', () => {
  const config = readE2EConfig();
  let user: ReturnType<typeof uniqueUser>;
  let accessToken: string;
  let sessionId: string;

  beforeEach(async () => {
    user = withVerifiedEmail(uniqueUser('sessions'));
    trackUserEmail(user.email);
    await api()
      .post('/v1/registration/public')
      .set(appHeaders(config.publicAppSlug))
      .send(user)
      .expect(201);
    const login = await api()
      .post('/v1/auth/login')
      .set(appHeaders(config.publicAppSlug))
      .send({ identifier: user.email, password: user.password })
      .expect(201);
    accessToken = login.body.data.accessToken;
    sessionId = login.body.data.sessionId;
  });

  afterEach(cleanupTrackedUsers);

  it('lists and retrieves the user’s own sessions', async () => {
    const list = await api()
      .get('/v1/sessions?status=active&limit=10')
      .set(appHeaders(config.publicAppSlug, { accessToken }))
      .expect(200);
    expect(list.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: sessionId, status: 'active' }),
      ]),
    );
    await api()
      .get(`/v1/sessions/${sessionId}`)
      .set(appHeaders(config.publicAppSlug, { accessToken }))
      .expect(200);
    await api()
      .get('/v1/sessions/not-a-session')
      .set(appHeaders(config.publicAppSlug, { accessToken }))
      .expect(404);
  });

  it('rejects app-bound tokens on a different app and permits access checks', async () => {
    await api()
      .get('/v1/sessions')
      .set(appHeaders(config.alternateAppSlug, { accessToken }))
      .expect(403);

    const userId = await withDatabase(async (client) => {
      const result = await client.query<{ id: string }>(
        'SELECT id FROM identity.users WHERE email = $1',
        [user.email],
      );
      return result.rows[0].id;
    });
    const allowed = await api()
      .post('/v1/app-access/check')
      .set(appHeaders(config.publicAppSlug))
      .send({ userId })
      .expect(201);
    expect(allowed.body.data.allowed).toBe(true);

    const denied = await api()
      .post('/v1/app-access/check')
      .set(appHeaders(config.publicAppSlug))
      .send({ userId: 'not-a-user' })
      .expect(201);
    expect(denied.body.data.allowed).toBe(false);
  });

  it('revokes one session and then all sessions for the current app', async () => {
    const revoked = await api()
      .delete(`/v1/sessions/${sessionId}`)
      .set(appHeaders(config.publicAppSlug, { accessToken }))
      .expect(200);
    expect(revoked.body.data.revoked).toBeGreaterThanOrEqual(1);

    const secondLogin = await api()
      .post('/v1/auth/login')
      .set(appHeaders(config.publicAppSlug))
      .send({ identifier: user.username, password: user.password })
      .expect(201);
    const revokeAll = await api()
      .delete('/v1/sessions')
      .set(
        appHeaders(config.publicAppSlug, {
          accessToken: secondLogin.body.data.accessToken,
        }),
      )
      .expect(200);
    expect(revokeAll.body.data.revoked).toBeGreaterThanOrEqual(1);
  });
});
