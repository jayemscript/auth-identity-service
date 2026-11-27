# Local API end-to-end tests

The E2E suite calls the already-running local service and PostgreSQL database. Before it connects, it reads `.env` directly and requires `DB_ENV=local`, a loopback `DB_HOST`, local HTTP URLs, and `DB_SSL=false`; values supplied only through the shell do not override these checks.

## Before running

1. Set `DB_ENV=local` in the repository `.env` and use a local PostgreSQL host.
2. Apply migrations and run the bootstrap seed with the public, admin, and alternate apps.
3. Set `SUPERADMINEMAIL` and `SUPERADMINPASSWORD` to the seeded SuperAdmin credentials.
4. Start the API on the `.env` `PORT` with the `.env` API key, then confirm `/health` reports ready.

The harness provisions temporary test credentials directly in the local database for the configured `E2E_PUBLIC_APP_SLUG`, `E2E_ADMIN_APP_SLUG`, and `E2E_ALTERNATE_APP_SLUG` values. Defaults are `public-ecommerce-web`, `internal-admin`, and `mobile-app`; the harness removes its credentials and test users after the run, and removes matching stale test users before a rerun. Use a disposable local database because the registration, login, session, grant, and user-config routes are exercised against it.

## Commands

```sh
make test-e2e
make test-e2e-serial
make test-e2e-file FILE=test/e2e/auth-jwks.e2e-spec.ts
make test-e2e-safety
```

The full run executes independent API suites with up to three Jest workers. Serial mode helps isolate state-sensitive failures, a file run selects one suite, and the safety command tests the environment gate without contacting PostgreSQL or the API.

## Adding coverage

Add a `*.e2e-spec.ts` file under `test/e2e/` and use the shared `api`, `appHeaders`, `uniqueUser`, and database helpers. Track every user created by an API request with `trackUserEmail` and call `cleanupTrackedUsers` in `afterEach`; do not delete or update bootstrap records. Include both the expected response and relevant rejection cases, and use only the seeded app slugs or unique test users.
