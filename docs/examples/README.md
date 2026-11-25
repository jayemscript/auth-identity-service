# Local V1 seed examples

These examples create one designated SuperAdmin, three apps, and 30 synthetic users. User emails use `example.com` and are not real accounts. The sample users share one password secret for local testing only; each receives access only to the apps listed in the seed file.

1. Copy `.env.example` to `.env`.
2. Set `BETTER_AUTH_URL` to the service's base URL (the example uses `http://localhost:7000`).
3. Set `SUPERADMINEMAIL` and `SUPERADMINPASSWORD`. The password must be generated, at least 8 characters, and not the placeholder.
4. Set `MOCK_USERS_PASSWORD` to a generated password of at least 8 characters. All 30 mock accounts use this password.
5. Start with a fresh database and apply the TypeORM migrations.
6. Run these from the repository root:

```sh
make bootstrap SEED_FILE=docs/examples/bootstrap.seed.example.json
make project-settings SETTINGS_FILE=docs/examples/project-settings.example.json
```

The bootstrap command seeds `internal-admin`, `public-ecommerce-web`, and `mobile-app`. The first mock user has access to all three apps and `canCreateUsers`; the other grants demonstrate single-app and multi-app access. Only the designated SuperAdmin can manage apps and grants.

The bootstrap `runKey` is stable. Re-running this seed after it has completed is a no-op; change `runKey` only when creating a deliberately new seed run. Keep `.env` local and never put passwords in the JSON seed file.
