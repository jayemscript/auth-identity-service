import { randomBytes } from 'node:crypto';
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

describe('domain events and webhook outbox', () => {
  const config = readE2EConfig();
  const subscriptions = [
    'user.created',
    'user.app_access.granted',
    'session.created',
  ];
  let applicationId: string;
  let endpointId: string;

  beforeAll(async () => {
    const endpointKey = `e2e-${config.runTag}`;
    ({ applicationId, endpointId } = await withDatabase(async (client) => {
      const app = await client.query<{ id: string }>(
        'SELECT id FROM apps.applications WHERE slug = $1',
        [config.eventAppSlug],
      );
      const endpoint = await client.query<{ id: string }>(
        `INSERT INTO events.webhook_endpoints
           (application_id, endpoint_key, url, event_types, secret_reference)
         VALUES ($1, $2, 'https://webhook.example.test/auth-events', $3::text[], 'e2e-secret-reference')
         RETURNING id`,
        [app.rows[0].id, endpointKey, subscriptions],
      );
      return { applicationId: app.rows[0].id, endpointId: endpoint.rows[0].id };
    }));
  });

  afterEach(async () => {
    await cleanupTrackedUsers();
  });

  it('publishes registration and session events with app-scoped pending deliveries and recognizes a device once', async () => {
    const user = withVerifiedEmail(uniqueUser('outbox'));
    trackUserEmail(user.email);
    const registration = await api()
      .post('/v1/registration/public')
      .set(appHeaders(config.eventAppSlug))
      .send(user)
      .expect(201);
    const userId = registration.body.data.userId as string;

    const registeredEvents = await withDatabase(async (client) => {
      const result = await client.query<{
        id: string;
        event_type: string;
        aggregate_id: string;
        payload: Record<string, unknown>;
      }>(
        `SELECT id, event_type, aggregate_id, payload
         FROM events.domain_events
         WHERE application_id = $1 AND aggregate_id = $2
         ORDER BY created_at, event_type`,
        [applicationId, userId],
      );
      return result.rows;
    });
    expect(registeredEvents.map(({ event_type }) => event_type).sort()).toEqual(
      ['user.app_access.granted', 'user.created'],
    );
    expect(registeredEvents.every(({ payload }) => payload.userId === userId)).toBe(true);
    expect(
      await withDatabase(async (client) => {
        const result = await client.query<{ count: number }>(
          `SELECT count(*)::int AS count FROM events.webhook_deliveries
           WHERE application_id = $1 AND endpoint_id = $2
             AND event_id = ANY($3::uuid[]) AND status = 'pending'`,
          [applicationId, endpointId, registeredEvents.map(({ id }) => id)],
        );
        return result.rows[0].count;
      }),
    ).toBe(2);

    const deviceId = randomBytes(18).toString('base64url');
    const firstLogin = await api()
      .post('/v1/auth/login')
      .set(appHeaders(config.eventAppSlug))
      .send({ identifier: user.email, password: user.password, deviceId })
      .expect(201);
    const firstSessionId = firstLogin.body.data.sessionId as string;

    const device = await withDatabase(async (client) => {
      const result = await client.query<{ id: string; device_id: string }>(
        `SELECT d.id, s.device_id
         FROM security.user_devices d
         JOIN auth.sessions s ON s.application_id = d.application_id AND s.device_id = d.id
         WHERE d.application_id = $1 AND d.user_id = $2 AND s.id = $3`,
        [applicationId, userId, firstSessionId],
      );
      return result.rows[0];
    });
    expect(device?.id).toEqual(expect.any(String));
    expect(device?.device_id).toBe(device?.id);

    await api()
      .post('/v1/auth/login')
      .set(appHeaders(config.eventAppSlug))
      .send({ identifier: user.username, password: user.password, deviceId })
      .expect(201);

    const deviceEvents = await withDatabase(async (client) => {
      const events = await client.query(
        `SELECT id FROM security.security_events
         WHERE application_id = $1 AND user_id = $2 AND event_type = 'device.new'`,
        [applicationId, userId],
      );
      const recognizedDevices = await client.query(
        `SELECT id FROM security.user_devices
         WHERE application_id = $1 AND user_id = $2`,
        [applicationId, userId],
      );
      const sessions = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM events.domain_events
         WHERE application_id = $1 AND event_type = 'session.created'
           AND payload->>'userId' = $2`,
        [applicationId, userId],
      );
      return { eventCount: events.rowCount, deviceCount: recognizedDevices.rowCount, sessionEventCount: sessions.rows[0].count };
    });
    expect(deviceEvents).toEqual({ eventCount: 1, deviceCount: 1, sessionEventCount: 2 });

    const otherAppUser = withVerifiedEmail(uniqueUser('outbox-isolation'));
    trackUserEmail(otherAppUser.email);
    const otherRegistration = await api()
      .post('/v1/registration/public')
      .set(appHeaders(config.securityAppSlug))
      .send(otherAppUser)
      .expect(201);
    const crossAppDeliveries = await withDatabase(async (client) => {
      const result = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM events.webhook_deliveries d
         JOIN events.domain_events e ON e.application_id = d.application_id AND e.id = d.event_id
         WHERE d.endpoint_id = $1 AND e.aggregate_id = $2`,
        [endpointId, otherRegistration.body.data.userId],
      );
      return result.rows[0].count;
    });
    expect(crossAppDeliveries).toBe(0);
  });

  it('rejects subscription names outside the event catalog', async () => {
    await withDatabase(async (client) => {
      await client.query('BEGIN');
      await client.query('SAVEPOINT invalid_subscription');
      try {
        await expect(
          client.query(
            `INSERT INTO events.webhook_endpoints
               (application_id, endpoint_key, url, event_types, secret_reference)
             VALUES ($1, $2, 'https://invalid.example.test/hook', ARRAY['user.created.custom'], 'e2e-secret-reference')`,
            [applicationId, `invalid-${config.runTag}`],
          ),
        ).rejects.toThrow(/unsupported event type/i);
      } finally {
        await client.query('ROLLBACK TO SAVEPOINT invalid_subscription');
        await client.query('COMMIT');
      }
    });
  });
});
