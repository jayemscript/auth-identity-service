import {
  api,
  appHeaders,
  cleanupTrackedUsers,
  readE2EConfig,
  trackUserEmail,
  uniqueUser,
  withVerifiedEmail,
} from './support';

describe('registration endpoints', () => {
  const config = readE2EConfig();
  let internalOperatorToken: string | undefined;

  afterEach(async () => {
    if (internalOperatorToken) {
      await api()
        .post('/v1/auth/logout')
        .set(
          appHeaders(config.adminAppSlug, {
            accessToken: internalOperatorToken,
          }),
        )
        .catch(() => undefined);
      internalOperatorToken = undefined;
    }
    await cleanupTrackedUsers();
  });

  it('registers a public user and returns a readable success response', async () => {
    const user = withVerifiedEmail(uniqueUser('public-registration'));
    trackUserEmail(user.email);
    const response = await api()
      .post('/v1/registration/public')
      .set(appHeaders(config.publicAppSlug))
      .send(user)
      .expect(201);
    expect(response.body.message).toMatch(/account was created/i);
    expect(response.body.data.userId).toEqual(expect.any(String));
  });

  it('rejects registration without required email proof', async () => {
    const user = uniqueUser('unverified');
    trackUserEmail(user.email);
    const response = await api()
      .post('/v1/registration/public')
      .set(appHeaders(config.publicAppSlug))
      .send(user)
      .expect(403);
    expect(response.body.message).toMatch(/verified email/i);
  });

  it('rejects duplicate registration with a readable conflict', async () => {
    const user = withVerifiedEmail(uniqueUser('duplicate'));
    trackUserEmail(user.email);
    await api()
      .post('/v1/registration/public')
      .set(appHeaders(config.publicAppSlug))
      .send(user)
      .expect(201);
    const response = await api()
      .post('/v1/registration/public')
      .set(appHeaders(config.publicAppSlug))
      .send(user)
      .expect(409);
    expect(response.body.message).toMatch(/already exists/i);
  });

  it('requires an operator token and allows an authorized internal registration', async () => {
    const user = withVerifiedEmail(uniqueUser('internal-registration'));
    trackUserEmail(user.email);
    await api()
      .post('/v1/registration/internal')
      .set(appHeaders(config.adminAppSlug))
      .send(user)
      .expect(401);

    const adminLogin = await api()
      .post('/v1/auth/login')
      .set(appHeaders(config.adminAppSlug))
      .send({
        identifier: config.superAdminEmail,
        password: config.superAdminPassword,
      })
      .expect(201);
    internalOperatorToken = adminLogin.body.data.accessToken;
    const response = await api()
      .post('/v1/registration/internal')
      .set(
        appHeaders(config.adminAppSlug, {
          accessToken: internalOperatorToken,
        }),
      )
      .send(user)
      .expect(201);
    expect(response.body.data.userId).toEqual(expect.any(String));
  });
});
