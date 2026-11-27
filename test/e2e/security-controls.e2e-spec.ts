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

describe('security rules and login lockouts', () => {
  const config = readE2EConfig();

  afterEach(async () => {
    await cleanupTrackedUsers();
    await withDatabase(async (client) => {
      await client.query('DELETE FROM security.ip_rules WHERE application_id = (SELECT id FROM apps.applications WHERE slug = $1)', [config.securityAppSlug]);
      await client.query('DELETE FROM security.email_domain_rules WHERE application_id = (SELECT id FROM apps.applications WHERE slug = $1)', [config.securityAppSlug]);
    });
  });

  it('enforces registration IP and email domain rules with deny precedence', async () => {
    const user = withVerifiedEmail(uniqueUser('blocked-rule'));
    trackUserEmail(user.email);
    const appId = await withDatabase(async (client) => {
      const app = await client.query<{ id: string }>('SELECT id FROM apps.applications WHERE slug = $1', [config.securityAppSlug]);
      await client.query(
        `INSERT INTO security.ip_rules(application_id,operation,effect,network)
         VALUES ($1,'registration','allow','127.0.0.0/8'),($1,'registration','deny','127.0.0.1/32')`,
        [app.rows[0].id],
      );
      await client.query(
        `INSERT INTO security.email_domain_rules(application_id,effect,domain)
         VALUES ($1,'allow','example.test'),($1,'deny','example.test')`,
        [app.rows[0].id],
      );
      return app.rows[0].id;
    });
    const response = await api()
      .post('/v1/registration/public')
      .set(appHeaders(config.securityAppSlug))
      .send(user)
      .expect(403);
    expect(response.body.code).toBe('IP_RULE_DENIED');

    await withDatabase(async (client) => {
      await client.query('DELETE FROM security.ip_rules WHERE application_id = $1', [appId]);
    });
    const domainResponse = await api()
      .post('/v1/registration/public')
      .set(appHeaders(config.securityAppSlug))
      .send(user)
      .expect(403);
    expect(domainResponse.body.code).toBe('EMAIL_DOMAIN_RULE_DENIED');
    await withDatabase(async (client) => {
      const result = await client.query('SELECT 1 FROM identity.users WHERE email = $1', [user.email]);
      expect(result.rowCount).toBe(0);
    });
  });

  it('blocks login from a denied network while allowing the same user through another app', async () => {
    const user = withVerifiedEmail(uniqueUser('login-ip'));
    trackUserEmail(user.email);
    await api().post('/v1/registration/public').set(appHeaders(config.publicAppSlug)).send(user).expect(201);
    const app = await withDatabase(async (client) => {
      const result = await client.query<{ id: string }>('SELECT id FROM apps.applications WHERE slug = $1', [config.securityAppSlug]);
      await client.query(
        `INSERT INTO security.ip_rules(application_id,operation,effect,network)
         VALUES ($1,'login','deny','0.0.0.0/0'),($1,'login','deny','::/0')`,
        [result.rows[0].id],
      );
      return result.rows[0].id;
    });
    const denied = await api()
      .post('/v1/auth/login')
      .set(appHeaders(config.securityAppSlug))
      .send({ identifier: user.email, password: user.password })
      .expect(403);
    expect(denied.body.code).toBe('IP_RULE_DENIED');
    await api()
      .post('/v1/auth/login')
      .set(appHeaders(config.publicAppSlug))
      .send({ identifier: user.email, password: user.password })
      .expect(201);
    await withDatabase((client) => client.query('DELETE FROM security.ip_rules WHERE application_id = $1', [app.id]).then(() => undefined));
  });

  it('locks invalid-password attempts by account across email and username identifiers', async () => {
    const user = withVerifiedEmail(uniqueUser('lockout'));
    trackUserEmail(user.email);
    await api().post('/v1/registration/public').set(appHeaders(config.lockoutAppSlug)).send(user).expect(201);

    for (const identifier of [user.email, user.username, user.email]) {
      await api()
        .post('/v1/auth/login')
        .set(appHeaders(config.lockoutAppSlug))
        .send({ identifier, password: 'incorrect-password' })
        .expect(401);
    }
    const locked = await api()
      .post('/v1/auth/login')
      .set(appHeaders(config.lockoutAppSlug))
      .send({ identifier: user.email, password: user.password })
      .expect(401);
    expect(locked.body.message).toMatch(/email, username, or password/i);

    await withDatabase(async (client) => {
      await client.query(
        `INSERT INTO identity.user_application_access
           (id, user_id, application_id, status, grant_source)
         SELECT gen_random_uuid(), u.id, a.id, 'active', 'operator'
         FROM identity.users u CROSS JOIN apps.applications a
         WHERE u.email = $1 AND a.slug = $2
         ON CONFLICT (user_id, application_id) DO UPDATE
           SET status = 'active', revoked_at = NULL`,
        [user.email, config.publicAppSlug],
      );
    });

    await api()
      .post('/v1/auth/login')
      .set(appHeaders(config.publicAppSlug))
      .send({ identifier: user.email, password: user.password })
      .expect(201);
    const attempts = await withDatabase(async (client) => {
      const result = await client.query<{ failures: number; locked: number }>(
        `SELECT (SELECT count(*)::int FROM security.login_attempts WHERE user_id = (SELECT id FROM identity.users WHERE email = $1) AND succeeded = false) AS failures,
                (SELECT count(*)::int FROM security.account_lockouts WHERE user_id = (SELECT id FROM identity.users WHERE email = $1) AND locked_until > now()) AS locked`,
        [user.email],
      );
      return result.rows[0];
    });
    expect(attempts).toMatchObject({ failures: 3, locked: 1 });
  });

  it('does not immediately relock from failures recorded before the expired lock', async () => {
    const user = withVerifiedEmail(uniqueUser('lockout-expiry'));
    trackUserEmail(user.email);
    await api().post('/v1/registration/public').set(appHeaders(config.lockoutAppSlug)).send(user).expect(201);
    for (let i = 0; i < 3; i++)
      await api().post('/v1/auth/login').set(appHeaders(config.lockoutAppSlug)).send({ identifier: user.email, password: 'incorrect-password' }).expect(401);
    await withDatabase(async (client) => {
      await client.query('UPDATE security.account_lockouts SET locked_until = now() - interval \'1 second\' WHERE user_id = (SELECT id FROM identity.users WHERE email = $1)', [user.email]);
    });
    await api().post('/v1/auth/login').set(appHeaders(config.lockoutAppSlug)).send({ identifier: user.email, password: 'incorrect-password' }).expect(401);
    const active = await withDatabase(async (client) => {
      const result = await client.query('SELECT 1 FROM security.account_lockouts WHERE user_id = (SELECT id FROM identity.users WHERE email = $1) AND locked_until > now()', [user.email]);
      return result.rowCount;
    });
    expect(active).toBe(0);
  });
});
