import {
  api,
  appHeaders,
  cleanupTrackedUsers,
  readE2EConfig,
  trackUserEmail,
  uniqueUser,
  withVerifiedEmail,
} from './support';

describe('authentication, tokens, and JWKS', () => {
  const config = readE2EConfig();
  let user: ReturnType<typeof uniqueUser>;
  let accessToken: string;
  let refreshToken: string;

  beforeEach(async () => {
    user = withVerifiedEmail(uniqueUser('auth'));
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
    refreshToken = login.body.data.refreshToken;
  });

  afterEach(cleanupTrackedUsers);

  it('signs in with username and returns only the V1 token pair', async () => {
    const response = await api()
      .post('/v1/auth/login')
      .set(appHeaders(config.publicAppSlug))
      .send({ identifier: user.username, password: user.password })
      .expect(201);
    expect(response.body.message).toMatch(/signed in/i);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        sessionId: expect.any(String),
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      }),
    );
    expect(JSON.stringify(response.body)).not.toMatch(/cookie|better-auth|opaque session/i);
  });

  it('returns a readable error for invalid credentials', async () => {
    const response = await api()
      .post('/v1/auth/login')
      .set(appHeaders(config.publicAppSlug))
      .send({ identifier: user.email, password: 'wrong-password' })
      .expect(401);
    expect(response.body.message).toMatch(/email, username, or password/i);
  });

  it('checks access token type and live session state', async () => {
    const response = await api()
      .post('/v1/auth/verify')
      .set(appHeaders(config.publicAppSlug))
      .send({ token: accessToken, tokenType: 'access' })
      .expect(201);
    expect(response.body.data).toMatchObject({
      active: true,
      appId: config.publicAppSlug,
    });

    const wrongType = await api()
      .post('/v1/auth/verify')
      .set(appHeaders(config.publicAppSlug))
      .send({ token: accessToken, tokenType: 'refresh' })
      .expect(201);
    expect(wrongType.body.data.active).toBe(false);
  });

  it('rotates a refresh token and rejects its replay', async () => {
    const refreshed = await api()
      .post('/v1/auth/refresh')
      .set(appHeaders(config.publicAppSlug))
      .send({ refreshToken })
      .expect(201);
    expect(refreshed.body.data.accessToken).toEqual(expect.any(String));
    expect(refreshed.body.data.refreshToken).toEqual(expect.any(String));
    await api()
      .post('/v1/auth/refresh')
      .set(appHeaders(config.publicAppSlug))
      .send({ refreshToken })
      .expect(401);
  });

  it('publishes public ES256 keys without private key material', async () => {
    const response = await api().get('/.well-known/jwks.json').expect(200);
    expect(Array.isArray(response.body.keys)).toBe(true);
    expect(response.body.keys.length).toBeGreaterThan(0);
    for (const key of response.body.keys) {
      expect(key).toMatchObject({ kty: 'EC', crv: 'P-256', alg: 'ES256' });
      expect(key.kid).toEqual(expect.any(String));
      expect(key).not.toHaveProperty('d');
    }
  });

  it('logs out the current session and makes its access token inactive', async () => {
    await api()
      .post('/v1/auth/logout')
      .set(appHeaders(config.publicAppSlug, { accessToken }))
      .expect(201);
    const verified = await api()
      .post('/v1/auth/verify')
      .set(appHeaders(config.publicAppSlug))
      .send({ token: accessToken, tokenType: 'access' })
      .expect(201);
    expect(verified.body.data.active).toBe(false);
  });
});
