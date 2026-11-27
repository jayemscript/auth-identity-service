import {
  api,
  appHeaders,
  cleanupTrackedUsers,
  readE2EConfig,
  trackUserEmail,
  uniqueUser,
  withDatabase,
  withVerifiedEmail,
} from './support';

describe('admin APIs', () => {
  const config = readE2EConfig();
  let targetUser: ReturnType<typeof uniqueUser>;
  let targetUserId: string;
  let targetSessionId: string;
  let adminToken: string;
  let adminUserId: string;

  beforeEach(async () => {
    targetUser = withVerifiedEmail(uniqueUser('admin-target'));
    trackUserEmail(targetUser.email);
    const registration = await api()
      .post('/v1/registration/public')
      .set(appHeaders(config.publicAppSlug))
      .send(targetUser)
      .expect(201);
    targetUserId = registration.body.data.userId;
    const targetLogin = await api()
      .post('/v1/auth/login')
      .set(appHeaders(config.publicAppSlug))
      .send({ identifier: targetUser.email, password: targetUser.password })
      .expect(201);
    targetSessionId = targetLogin.body.data.sessionId;

    const adminLogin = await api()
      .post('/v1/auth/login')
      .set(appHeaders(config.adminAppSlug))
      .send({
        identifier: config.superAdminEmail,
        password: config.superAdminPassword,
      })
      .expect(201);
    adminToken = adminLogin.body.data.accessToken;
    adminUserId = await withDatabase(async (client) => {
      const result = await client.query<{ id: string }>(
        'SELECT id FROM identity.users WHERE email = $1',
        [config.superAdminEmail],
      );
      return result.rows[0].id;
    });
  });

  afterEach(async () => {
    if (adminToken) {
      await api()
        .post('/v1/auth/logout')
        .set(appHeaders(config.adminAppSlug, { accessToken: adminToken }))
        .catch(() => undefined);
    }
    await cleanupTrackedUsers();
  });

  const adminHeaders = () =>
    appHeaders(config.adminAppSlug, { accessToken: adminToken });

  it('reads registered apps and an app by slug', async () => {
    const list = await api()
      .get('/v1/admin/apps')
      .set(adminHeaders())
      .expect(200);
    expect(list.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ slug: config.publicAppSlug }),
    ]));
    const app = await api()
      .get(`/v1/admin/apps/${config.publicAppSlug}`)
      .set(adminHeaders())
      .expect(200);
    expect(app.body.data.slug).toBe(config.publicAppSlug);
  });

  it('grants and revokes app access and updates a user config', async () => {
    await api()
      .put(`/v1/admin/apps/${config.alternateAppSlug}/users/${targetUserId}/access`)
      .set(adminHeaders())
      .expect(200);
    const access = await api()
      .post('/v1/app-access/check')
      .set(appHeaders(config.alternateAppSlug))
      .send({ userId: targetUserId })
      .expect(201);
    expect(access.body.data.allowed).toBe(true);
    const alternateLogin = await api()
      .post('/v1/auth/login')
      .set(appHeaders(config.alternateAppSlug))
      .send({ identifier: targetUser.email, password: targetUser.password })
      .expect(201);

    const configUpdate = await api()
      .patch(`/v1/admin/users/${targetUserId}/config`)
      .set(adminHeaders())
      .send({ canCreateUsers: true, sessionLimitOverride: 4 })
      .expect(200);
    expect(configUpdate.body.message).toMatch(/settings were updated/i);
    const updated = await withDatabase(async (client) => {
      const result = await client.query<{
        can_create_users: boolean;
        session_limit_override: number;
      }>(
        `SELECT can_create_users, session_limit_override
         FROM identity.user_configs WHERE user_id = $1`,
        [targetUserId],
      );
      return result.rows[0];
    });
    expect(updated).toMatchObject({
      can_create_users: true,
      session_limit_override: 4,
    });

    await api()
      .patch(`/v1/admin/users/${targetUserId}/config`)
      .set(adminHeaders())
      .send({ sessionLimitOverride: 1 })
      .expect(200);
    const sessionLimit = await api()
      .post('/v1/auth/login')
      .set(appHeaders(config.publicAppSlug))
      .send({ identifier: targetUser.username, password: targetUser.password })
      .expect(409);
    expect(sessionLimit.body.code).toBe('SESSION_LIMIT_REACHED');

    await api()
      .delete(`/v1/admin/apps/${config.alternateAppSlug}/users/${targetUserId}/access`)
      .set(adminHeaders())
      .expect(200);
    const revoked = await api()
      .post('/v1/app-access/check')
      .set(appHeaders(config.alternateAppSlug))
      .send({ userId: targetUserId })
      .expect(201);
    expect(revoked.body.data.allowed).toBe(false);
    const staleSession = await api()
      .post('/v1/auth/verify')
      .set(appHeaders(config.alternateAppSlug))
      .send({
        token: alternateLogin.body.data.accessToken,
        tokenType: 'access',
      })
      .expect(201);
    expect(staleSession.body.data.active).toBe(false);
  });

  it('protects the SuperAdmin grant and manages a user’s sessions', async () => {
    await api()
      .delete(`/v1/admin/apps/${config.adminAppSlug}/users/${adminUserId}/access`)
      .set(adminHeaders())
      .expect(403);

    const list = await api()
      .get(`/v1/admin/apps/${config.publicAppSlug}/users/${targetUserId}/sessions`)
      .set(adminHeaders())
      .expect(200);
    expect(list.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: targetSessionId }),
    ]));
    await api()
      .get(`/v1/admin/apps/${config.publicAppSlug}/users/${targetUserId}/sessions/${targetSessionId}`)
      .set(adminHeaders())
      .expect(200);
    await api()
      .delete(`/v1/admin/apps/${config.publicAppSlug}/users/${targetUserId}/sessions/${targetSessionId}`)
      .set(adminHeaders())
      .expect(200);
  });

  it('rejects admin reads without an access token', async () => {
    await api()
      .get('/v1/admin/apps')
      .set(appHeaders(config.adminAppSlug))
      .expect(401);
  });
});
