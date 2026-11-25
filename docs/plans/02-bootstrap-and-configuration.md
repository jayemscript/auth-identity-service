# V1 bootstrap and configuration

## Bootstrap

- Seed exactly one SuperAdmin and zero or more explicitly listed regular users. Seed one or more apps, with exactly one selected for SuperAdmin login and management. Roam Tour can start with the two consumer apps and designate `business-dashboard` if its backend also handles operator access. This gives the deployment an admin path from its first launch. Additional apps can be registered over REST afterward.
- Use a seed script with structured input containing a stable `runKey`, the designated admin app slug, global settings, app records and policy overrides, and optional users with password secret references, user config values, and explicit app slugs. Create user and credential records through Better Auth using its configured Argon2id password hasher. Read SuperAdmin credentials from `SUPERADMINEMAIL` and `SUPERADMINPASSWORD`. Require a generated password supplied through deployment secrets and reject the sample value. Defer forced first-login password changes with the password-change flow.
- Automatically grant the SuperAdmin access to the designated app. Give optional users only their listed grants. Validate referenced apps and normalized uniqueness before committing. Write the records and bootstrap completion marker in one transaction, with the unique run key preventing duplicate concurrent seeds. A completed run is a no-op on rerun. A conflict during the first run rolls back the seed. Keep passwords and API keys out of seed input files and bootstrap metadata.

## Configuration

| Configuration | V1 fields and defaults |
| --- | --- |
| User config | Account status, ban flag and optional expiry, service-only `is_superadmin`, `can_create_users` defaulting to `false`, nullable concurrent-session override, and creation source and actor/app identifiers. Profile and canonical email verification fields belong in `identity.users`; credential hashes belong in `identity.accounts`. |
| App config | Stable case-insensitive slug, display name, descriptive client type, active or disabled status, and optional overrides for registration mode, public email verification, idle timeout, and concurrent-session limit. |
| Project settings | `registration.mode = public`, `email_verification.required = false`, `session.idle_timeout_seconds = 604800` (7 days), `session.max_concurrent = 3`, and one seed-selected `administration.app_slug`. |
| Deployment settings | Use `BETTER_AUTH_SECRET` for Better Auth internal signing and hashing, `JWT_SECRET` for the V1 HS256 token pair, and `API_KEY` for calling backends. Use the existing `JWT_ACCESS_EXPIRATION` default of 900 seconds and `JWT_REFRESH_EXPIRATION` default of 2,592,000 seconds. The latter sets the hard session lifetime at login. |

Resolve registration and idle settings from app override, project value, then built-in default. For concurrent sessions, apply the user override first and still count per user-app pair. Validate positive timeouts and limits, and require each effective idle timeout to fall between the access-token lifetime and hard session lifetime. Changes apply to subsequent operations. Lowering the cap blocks new sessions without ending existing ones, and an existing absolute deadline stays fixed. Project settings are managed with `make project-settings SETTINGS_FILE=...`; seed with `make bootstrap SEED_FILE=...`. Both commands validate structured files and apply writes transactionally. App overrides can be managed through REST.

Better Auth model names map to the schema-owned tables `identity.users`, `identity.accounts`, `auth.sessions`, and `auth.verifications`. TypeORM owns these tables and their indexes through reversible migrations; Better Auth runtime table mapping does not create or migrate tables. `apps` contains only `applications` in V1; `system` contains only `settings` and `bootstrap_runs`.

## Consuming-backend configuration

| Backend setting | Purpose |
| --- | --- |
| `AUTH_SERVICE_URL` | Base URL, such as `http://localhost:7000` in development. |
| `AUTH_SERVICE_HEALTH_URL` | Readiness URL, such as `http://localhost:7000/health`. |
| `AUTH_SERVICE_APP_ID` | Database app slug, such as `meal-guides-merchant`, sent as `X-App-Id`. |
| `AUTH_SERVICE_INTERNAL_API_KEY` | Same value as the identity service’s `API_KEY`, sent as `X-API-Key`. |
| `AUTH_SERVICE_TIMEOUT_MD` | Consumer request timeout in milliseconds, using the supplied key name. |

All consuming backends in a deployment share one API key, kept server-side and sent over TLS outside local development. `X-App-Id` selects the registered app and its policy. Every key holder is trusted to supply the correct app ID and accurate email assertions. The shared key cannot independently identify a backend. Admin calls additionally require a live SuperAdmin access token issued for the designated app. Rotate the shared key as a coordinated deployment change. Keep the JWT signing key inside the identity service.

`GET /health` requires the shared key and reports readiness with `200` or `503`. Business endpoints also require an active app. Leave the project’s app slugs, initial users, grants, secrets, and policy overrides as deployment inputs.
