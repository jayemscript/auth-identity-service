import { api, appHeaders, readE2EConfig } from './support';

describe('app credentials and request authorization', () => {
  const config = readE2EConfig();

  it('rejects the shared health key on a versioned API route', async () => {
    await api()
      .post('/v1/auth/login')
      .set('X-API-Key', config.apiKey)
      .set('X-App-Id', config.publicAppSlug)
      .send({ identifier: 'nobody@example.test', password: 'incorrect' })
      .expect(401);
  });

  it('rejects missing app credentials and app IDs', async () => {
    await api()
      .post('/v1/auth/login')
      .send({ identifier: 'nobody@example.test', password: 'incorrect' })
      .expect(401);

    await api()
      .post('/v1/auth/login')
      .set('X-API-Key', appHeaders(config.publicAppSlug)['X-API-Key'])
      .send({ identifier: 'nobody@example.test', password: 'incorrect' })
      .expect(401);
  });

  it('rejects a credential when its bound app does not match X-App-Id', async () => {
    await api()
      .post('/v1/auth/login')
      .set('X-API-Key', appHeaders(config.publicAppSlug)['X-API-Key'])
      .set('X-App-Id', config.alternateAppSlug)
      .send({ identifier: 'nobody@example.test', password: 'incorrect' })
      .expect(401);
  });

  it('rejects operations outside the credential scope set', async () => {
    const response = await api()
      .post('/v1/registration/public')
      .set(appHeaders(config.publicAppSlug, { profile: 'limited' }))
      .send({ name: 'Denied User', email: 'denied@example.test', password: 'LocalTest123!' })
      .expect(403);
    expect(response.body.message).toMatch(/permission/i);
  });
});
