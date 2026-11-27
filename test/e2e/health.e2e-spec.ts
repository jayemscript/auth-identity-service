import { api, readE2EConfig } from './support';

describe('health endpoint', () => {
  const config = readE2EConfig();

  it('reports ready with the shared health API key', async () => {
    const response = await api()
      .get('/health')
      .set('X-API-Key', config.apiKey)
      .expect(200);
    expect(response.body).toMatchObject({ data: { status: 'ready' } });
  });

  it.each([undefined, 'invalid-local-health-key'])(
    'rejects a missing or invalid shared API key (%s)',
    async (key) => {
      const call = api().get('/health');
      if (key) call.set('X-API-Key', key);
      const response = await call.expect(401);
      expect(response.body.message).toMatch(/API key/i);
    },
  );
});
