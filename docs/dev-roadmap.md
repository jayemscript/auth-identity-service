# Identity Service: Development Roadmap

Build in small phases. Each phase ends with a gate: every test passes and every verify item is checked before the next phase starts. Estimates assume one developer working full time.

## Rules

1. Do not start a phase until the previous gate is closed.
2. Every feature ships with automated tests (unit plus e2e against a real Postgres, not mocks).
3. Every schema change is a TypeORM migration. Never use `synchronize`.
4. Keep a `CHANGELOG.md`. Tag a version at the end of each phase.
5. If a phase's verify item fails, fix it in that phase. Do not carry known bugs forward.

## Overview

| Phase | Name | Estimate |
|---|---|---|
| 0 | Foundation and adapter spike | 3 to 5 days |
| 1 | Core identity and sessions | 1 to 1.5 weeks |
| 2 | Email infrastructure, verification, password reset | 1 week |
| 3 | Settings, profiles, bootstrap superadmin | 1 week |
| 4 | Apps registry and service-to-service auth | 1 week |
| 5 | Security hardening | 1 to 1.5 weeks |
| 6 | Two-factor authentication | 1 week |
| 7 | Magic link, email OTP, passkeys | 1.5 weeks |
| 8 | Social logins | 1 week |
| 9 | Account management and privacy | 1 week |
| 10 | Events and webhooks | 1 week |
| 11 | Admin API for the dashboard | 1 week |
| 12 | Production readiness | 1 to 1.5 weeks |
| 13 | Internal dashboard (separate repo) | Separate plan |

Total for the service: about 13 to 16 weeks.

---

## Phase 0: Foundation and adapter spike

Goal: prove the stack works before building on it.

Build:
- [ ] Repo `identity-service`: NestJS, TypeScript strict, ESLint, Prettier
- [ ] `docker-compose.yml` with Postgres and Mailpit
- [ ] Config module with validated env (fail fast on missing values)
- [ ] TypeORM connection, migration runner, first migration that creates the 8 schemas and extensions
- [ ] CI: lint, build, test on every push
- [ ] Better-auth mounted in NestJS with a TypeORM adapter (community or custom)
- [ ] Decide: adapter choice, session token hashing, `is_superadmin` versus `role` for the admin plugin

Test:
- [ ] Adapter can create, read, update, delete a `user`, `account`, `session`, `verification` in the mapped schema tables
- [ ] Migrations run clean on an empty database and roll back

Verify (gate):
- [ ] Sign up and sign in with email and password works end to end against the mapped tables
- [ ] Decisions above written down in the repo (`docs/decisions.md`)

---

## Phase 1: Core identity and sessions

Build:
- [ ] Migrations and entities: `identity.users`, `identity.accounts`, `auth.sessions`
- [ ] Sign up, sign in, sign out (email and password, optional username)
- [ ] Password hashing with argon2id
- [ ] Session list and revoke one or revoke all
- [ ] Session idle and absolute expiry
- [ ] Standard error format and request id on every response
- [ ] Health endpoints (`/health/live`, `/health/ready`)

Test:
- [ ] Duplicate email and username rejected, case-insensitive
- [ ] Wrong password rejected with a generic message
- [ ] Expired and revoked sessions are rejected
- [ ] Password is never returned or logged

Verify (gate):
- [ ] Full flow works from a plain HTTP client and from a small test frontend
- [ ] Cookie and bearer usage both confirmed
- [ ] Coverage on auth paths above 80 percent

---

## Phase 2: Email infrastructure, verification, password reset

Build:
- [ ] Migrations: `auth.verifications`, `messaging.email_messages`, `messaging.email_suppressions`
- [ ] SMTP sender (nodemailer), HTML plus text parts
- [ ] Queue worker (decide BullMQ or Postgres `SKIP LOCKED`), retries with backoff
- [ ] Layout system: `classic@1` layout, template functions returning `{ subject, html, text }`, CSS inlined
- [ ] Email verification flow
- [ ] Forgot password and reset flow, revoke all sessions after reset

Test:
- [ ] Tokens are single use, expire, and are stored hashed
- [ ] Unknown email returns the same response as a known one
- [ ] Failed SMTP retries and ends in `failed` without blocking the request
- [ ] Suppressed addresses are not sent to
- [ ] Every inserted template value is escaped

Verify (gate):
- [ ] Emails render correctly in Mailpit, and in at least Gmail and Outlook through a rendering test
- [ ] No token or OTP appears in `email_messages.variables`, logs or audit rows
- [ ] Redirect URI in emails is validated (placeholder allowlist until phase 4)

---

## Phase 3: Settings, profiles, bootstrap superadmin

Build:
- [ ] Migrations: `system.settings`, `system.bootstrap_runs`
- [ ] Settings service with typed keys, validation, caching, optimistic version
- [ ] Settings drive behavior: `registration.mode`, `email_verification.required`, password policy, session timeouts
- [ ] Profile files: `marketplace`, `internal`, `saas`, `standalone`
- [ ] Idempotent superadmin seed (`is_superadmin`, `is_system_account`, `must_change_password`)
- [ ] `pnpm setup` command: project name, profile, database name, SMTP, origins, superadmin email

Test:
- [ ] Seed runs twice without duplicating anything
- [ ] `registration.mode = closed` blocks sign up; `invite_only` allows only invited users
- [ ] Invalid setting combinations stop the service at boot
- [ ] Superadmin must change password on first login

Verify (gate):
- [ ] Brand new project goes from clone to running service using only `pnpm setup`
- [ ] Each of the 4 profiles boots and behaves as documented
- [ ] Bootstrap password is not logged

---

## Phase 4: Apps registry and service-to-service auth

Build:
- [ ] Migrations: `apps.applications`, `apps.application_credentials`
- [ ] Application CRUD (superadmin only)
- [ ] CORS and trusted origins read from the registry
- [ ] Redirect URI validation against `redirect_uris` everywhere a URL is accepted
- [ ] Client credentials: create, show secret once, store hashed, rotate, revoke
- [ ] Scope checks on the service API (`users:read`, `sessions:revoke`, ...)
- [ ] Sessions and verifications tagged with `application_id`

Test:
- [ ] Unknown origin and unknown redirect URI are rejected
- [ ] Revoked and expired credentials rejected
- [ ] A credential without the scope is rejected
- [ ] Same user signs into two registered apps with the same identity

Verify (gate):
- [ ] A test backend authenticates to the service using client credentials
- [ ] user-a signed into app-1 and app-2 resolves to the same `users.id`
- [ ] No open-redirect possible (manual test with hostile URLs)

---

## Phase 5: Security hardening

Build:
- [ ] Migrations: `security.audit_logs`, `security_events`, `login_attempts`, `account_lockouts`, `ip_rules`, `email_domain_rules`, `rate_limits`, `user_devices`, `identity.password_history`
- [ ] Rate limiting per route, by IP and by identifier
- [ ] Login attempt tracking, escalating lockout
- [ ] Audit logging for admin and sensitive actions (with hash chain if chosen)
- [ ] Security events and new-device alert email
- [ ] IP rules and email domain rules
- [ ] Password policy: min length, breached check, history
- [ ] Insert-only grants on audit tables via migration

Test:
- [ ] Threshold failures lock the account, lock expires, repeat lock is longer
- [ ] Locked and unknown accounts return the same generic response
- [ ] Rate limits trigger and reset correctly
- [ ] Password reuse and breached passwords rejected
- [ ] The app DB role cannot update or delete audit rows

Verify (gate):
- [ ] Credential stuffing simulation (many users, few attempts each) is detected
- [ ] Audit log records every admin action tried so far
- [ ] No sensitive value appears in any log table

---

## Phase 6: Two-factor authentication

Build:
- [ ] Migration: `mfa.two_factors`
- [ ] TOTP enroll, verify, disable
- [ ] Backup codes: generate, use once, regenerate
- [ ] Trusted device ("remember this device") using `security.user_devices`
- [ ] `mfa.policy` setting (`off`, `optional`, `required`) enforced
- [ ] Secrets and backup codes encrypted with versioned key

Test:
- [ ] Wrong and reused codes rejected, attempts limited
- [ ] Backup code works once only
- [ ] Required policy blocks access until enrolled
- [ ] Trusted device skips MFA until `trusted_until`, and revoking works

Verify (gate):
- [ ] Works with at least two authenticator apps
- [ ] Key rotation test: change `key_version`, existing secrets still verify
- [ ] Superadmin cannot sign in without MFA

---

## Phase 7: Magic link, email OTP, passkeys

Build:
- [ ] Magic link sign in (uses `verifications`, validated redirect)
- [ ] Email OTP sign in and verification
- [ ] Migration: `mfa.passkeys`; register, list, rename, delete, sign in with passkey
- [ ] Each method switchable in settings and its routes hidden when off

Test:
- [ ] Links and codes are single use, short lived, attempt limited
- [ ] Disabled method returns not found
- [ ] Passkey counter regression is rejected
- [ ] Last remaining sign-in method cannot be removed

Verify (gate):
- [ ] Passkey works on desktop browser and a phone
- [ ] Magic link works across devices and fails safely when expired or reused

---

## Phase 8: Social logins

Build:
- [ ] Google first, then GitHub, then Apple (one at a time)
- [ ] Account linking rules: link only when the provider email is verified
- [ ] Encrypted token storage with `token_key_version`
- [ ] Unlink provider, blocked when it is the last method

Test:
- [ ] Same verified email links to the existing identity, not a duplicate
- [ ] Unverified provider email does not auto-link
- [ ] Tokens are encrypted at rest

Verify (gate):
- [ ] Each provider tested against its real sandbox or production credentials
- [ ] Sign in with a provider on app-1 then app-2 yields the same `users.id`

---

## Phase 9: Account management and privacy

Build:
- [ ] Migrations: `identity.user_consents`, `identity.deletion_requests`
- [ ] Update profile, change email (verify new address), change password (revoke other sessions)
- [ ] Deactivate and reactivate
- [ ] Consent recording
- [ ] Account deletion with grace period, cancellation, purge job, anonymization
- [ ] Data export

Test:
- [ ] Email change only completes after the new address is verified
- [ ] Deletion grace period, cancel, and purge all work
- [ ] After purge, no PII remains in `users` or logs, and the email can be re-registered
- [ ] Export contains only that user's data

Verify (gate):
- [ ] Delete an account end to end and check every table by hand
- [ ] Export file reviewed for accidental secrets

---

## Phase 10: Events and webhooks

Build:
- [ ] Migrations: `events.domain_events`, `webhook_endpoints`, `webhook_deliveries`
- [ ] Outbox writes in the same transaction as each change
- [ ] Dispatcher with signed requests (HMAC), retries with backoff, dead state
- [ ] Event catalog from the design doc implemented
- [ ] Auto-disable failing endpoints

Test:
- [ ] Event is written only if the transaction commits
- [ ] Signature verifies, replay of the same event id is safe
- [ ] Failing endpoint goes to retries, then dead, and is replayable

Verify (gate):
- [ ] Test app receives `user.created`, `session.revoked`, `user.deleted` and acts on them
- [ ] Killing the dispatcher mid-run loses no events

---

## Phase 11: Admin API for the dashboard

Build:
- [ ] Users: search, create, invite, update, ban, deactivate, delete, force password reset, reset MFA
- [ ] Sessions: list, revoke
- [ ] Apps and credentials, webhooks and deliveries, settings
- [ ] Security events, audit logs, lockouts, IP and domain rules, email queue
- [ ] Pagination, filtering and consistent error shapes everywhere
- [ ] OpenAPI spec generated and published

Test:
- [ ] Every endpoint rejects non-superadmin and insufficient scopes
- [ ] Every mutation writes an audit row

Verify (gate):
- [ ] OpenAPI spec is enough for the dashboard to be built without reading service code
- [ ] Impersonation is audited and clearly marked on the session

---

## Phase 12: Production readiness

Build:
- [ ] Retention jobs and monthly partition management
- [ ] Dockerfile, production compose or Helm chart, env documentation
- [ ] Structured logging, metrics, alerts (login failures, lockouts, dead webhooks, email queue age)
- [ ] Backup and restore procedure, tested
- [ ] DB roles (`auth_migrator`, `auth_app`, `auth_readonly`)
- [ ] Key rotation runbook, JWKS rotation if used
- [ ] Load test of sign in and session lookup
- [ ] Security review: dependency audit, OWASP ASVS checklist, hostile-input testing
- [ ] Docs: README, setup guide, profile guide, template customization, upgrade guide

Test:
- [ ] Retention jobs delete only what they should
- [ ] Restore from backup into a fresh database and run the service against it
- [ ] Load test meets your targets with no errors

Verify (gate):
- [ ] A new project is created from the template by following only the docs
- [ ] Tag `v1.0.0`

---

## Phase 13: Internal dashboard (separate repo, `identity-dashboard`)

Plan it once phase 11 is done. It consumes the OpenAPI spec and uses the same phase rules: build a screen, test it, verify against the live service, then move on.

---

## Per-phase checklist (copy into each PR)

- [ ] Migration written and tested up and down
- [ ] Unit and e2e tests added and green in CI
- [ ] Negative cases tested (bad input, expired, reused, unauthorized)
- [ ] No secrets in logs, audit rows or error messages
- [ ] Settings keys documented
- [ ] OpenAPI updated
- [ ] CHANGELOG updated and version tagged
