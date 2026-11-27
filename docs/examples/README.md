# Local V1 seed examples

These examples create one designated SuperAdmin, four apps, and 30 synthetic users on the first run. User emails use `example.com` and are not real accounts. The sample users share one password secret for local testing only; each receives access only to the apps listed in their grants.

1. Copy `.env.example` to `.env`.
2. Set `BETTER_AUTH_URL` to the service's base URL (the example uses `http://localhost:7000`).
3. Set `SUPERADMINEMAIL` and `SUPERADMINPASSWORD`. The password must be generated, at least 8 characters, and not the placeholder.
4. Set `MOCK_USERS_PASSWORD` to a generated password of at least 8 characters. All 30 mock accounts use this password.
5. Start with a fresh database and apply the TypeORM migrations.
6. Run these from the repository root:

```sh
make bootstrap SEED_FILE=docs/examples/bootstrap.seed.example.json
make project-settings SETTINGS_FILE=docs/examples/project-settings.example.json
make issue-app-credential APP_SLUG=public-ecommerce-web CREDENTIAL_NAME=public-ecommerce-web SCOPES=auth:login,tokens:verify,tokens:refresh,users:register
```

Run credential issuance after applying migrations and bootstrapping the apps. It uses the existing `public-ecommerce-web` slug from this seed. `CREDENTIAL_NAME` is just a label for the issued key, so it can use the same name. Save the one-time `id.secret` output as the `X-API-Key` value in Postman. The key has the scopes listed in the command. The bootstrap command seeds `internal-admin`, `public-ecommerce-web`, `mobile-app`, and `customer-app`. The first mock user has access to the original three apps and `canCreateUsers`; `customer-app` demonstrates adding an app without re-seeding users. Only the designated SuperAdmin can manage user grants.

The bootstrap `runKey` is stable. The first app listed in the seed becomes the administration app and receives the SuperAdmin account. Keep that app first on later runs because its slug is stored as an immutable system setting. Re-running the same seed adds any new app entries while leaving existing app records, users, grants, and settings untouched; changing an existing app’s metadata causes an error. Run the append-only migration before bootstrap, keep `.env` local, and never put passwords in the JSON seed file.
