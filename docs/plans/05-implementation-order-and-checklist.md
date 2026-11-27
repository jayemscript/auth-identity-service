# V1 implementation order and checklist

## Implementation and verification

1. Pin Better Auth and map its user/account models to `identity.users` and `identity.accounts`, and session/verification models to `auth.sessions` and `auth.verifications`. Establish Argon2id and username configuration, TypeORM-managed schemas, shared transactional writes, reversible migrations, repositories, settings validation, bootstrap (`make bootstrap SEED_FILE=...`), project policy updates (`make project-settings SETTINGS_FILE=...`), and the shared-key guard. Verify fresh install, restart, repeat seed, and rollback after a failing migration or seed, including failures after Better Auth has created records.
2. Implement app/grant checks and both registration paths. Use module unit tests for each `execute()` operation and PostgreSQL-backed integration tests for uniqueness and atomicity. Cover disabled registration, missing email proof, and unauthorized internal actors.
3. Implement login, online token verification, refresh, and session management. Cover wrong token type, wrong app, another deployment’s token, both expiry deadlines, refresh reuse, concurrent logins at the limit, and database failure.
4. Implement read-only app administration and additive deployment bootstrap. Verify that completed seeds can add apps without rewriting existing records, database updates/deletes of app rows are rejected, and unauthorized admin requests fail.

## V1 done when

- [ ] A fresh deployment seeds one working SuperAdmin, its designated app, and only the optional users and grants supplied. Re-running the seed creates no duplicates.
- [ ] A consuming app registers a user through Better Auth publicly with verification off or accepted backend proof when it is on. An authorized actor can also register a user internally. Both routes atomically create the Better Auth records, user config, and app grant.
- [ ] A consuming app logs in and receives an access and refresh pair. Identity verifies both against live session state without persisting the tokens or their hashes.
- [ ] A consuming app can read and list its user’s sessions, refresh them, revoke one or all, and observe idle and hard expiry. Another device is rejected when the per-app limit is reached.
- [ ] A consuming app can log out the current session and confirm that both token types fail afterward. Other sessions remain usable.
- [ ] The SuperAdmin can read registered apps and manage user grants. New apps are added by bootstrap without changing existing app identities. A consuming app can check user access, and revoking a grant invalidates the affected sessions.
