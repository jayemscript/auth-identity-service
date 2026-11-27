# Auth Identity Service

Headless NestJS authentication and identity API for registered applications. Better Auth handles credential accounts and framework sessions; this service issues app-bound tokens, manages sessions and grants, and verifies backend credentials.

## Install and configure

Requirements: Node.js, pnpm, and PostgreSQL.

```sh
pnpm install
cp .env.example .env
```

Set the PostgreSQL connection values in `.env` (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`, and `DB_SSL`). Generate real values for `BETTER_AUTH_SECRET`, `JWT_SECRET`, `API_KEY`, `LOGIN_SUBJECT_HMAC_SECRET`, `SUPERADMINPASSWORD`, and `MOCK_USERS_PASSWORD` before bootstrapping. Set `DEVICE_ID_HMAC_SECRET` to a separate generated secret if login requests use `deviceId`. `API_KEY` is the shared key for `GET /health`; `/v1` routes use app credentials instead. `DB_ENV=local` is required by the local E2E test safety check.

## Migrate, bootstrap, and run

Apply the TypeORM migrations, then load the example apps, SuperAdmin, and mock users:

```sh
make run_migration
make bootstrap SEED_FILE=docs/examples/bootstrap.seed.example.json
make dev
```

Set `SUPERADMINEMAIL`, `SUPERADMINPASSWORD`, and `MOCK_USERS_PASSWORD` in `.env` first. To use your own seed, copy and edit the example JSON, then pass its path to `SEED_FILE`. App slugs, names, client types, and policies are immutable after insertion; add a new app as a new seed entry with a new slug. Use `make project-settings SETTINGS_FILE=docs/examples/project-settings.example.json` to set deployment defaults.

## Issue a credential for a client backend

Issue a separate credential for each consuming backend. Use the exact app slug from the bootstrap seed and grant only the scopes that backend needs:

```sh
make issue-app-credential APP_SLUG=public-ecommerce-web CREDENTIAL_NAME=client-backend SCOPES=auth:login,tokens:verify,tokens:refresh,users:register,sessions:read:self,sessions:revoke:self
```

The command prints the credential once as `<credential-id>.<secret>`. Store it in the backend’s private secret configuration and never in a browser or mobile app. Revoke it with `make revoke-app-credential APP_SLUG=public-ecommerce-web CREDENTIAL_ID=<credential-id>`.

Example consuming backend configuration:

```dotenv
AUTH_SERVICE_URL=http://localhost:7000
AUTH_SERVICE_HEALTH_URL=http://localhost:7000/health
AUTH_SERVICE_APP_ID=public-ecommerce-web
AUTH_SERVICE_INTERNAL_API_KEY=<same value as the auth service API_KEY>
AUTH_CREDENTIAL_KEY=<credential-id>.<secret>
AUTH_SERVICE_TIMEOUT_MS=10000
```

For `/v1` requests, send `AUTH_CREDENTIAL_KEY` as `X-API-Key` and `AUTH_SERVICE_APP_ID` as `X-App-Id`. `AUTH_SERVICE_INTERNAL_API_KEY` is the shared auth-service `API_KEY` and only authorizes `/health`; it does not authorize `/v1` requests. If the backend does not call `/health`, it does not need that setting.

## API documentation and tests

The Postman-oriented endpoint guide is in [`docs/api/README.md`](docs/api/README.md), with request details in the Markdown files in `docs/api/`. Run local-only end-to-end tests with `make test-e2e`; use `make test-e2e-serial` or `make test-e2e-file FILE=test/e2e/auth-jwks.e2e-spec.ts` to narrow a run. The suite requires `DB_ENV=local`, a local database, migrations and bootstrap, and a running API.
