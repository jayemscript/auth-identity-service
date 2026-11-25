# V1 implementation order and checklist

## Implementation and verification

1. Establish transactional schema migrations, repositories, settings validation, bootstrap, and the shared-key guard. Verify fresh install, restart, repeat seed, and rollback after a failing migration or seed.
2. Implement app/grant checks and both registration paths. Use module unit tests for each `execute()` operation and PostgreSQL-backed integration tests for uniqueness and atomicity. Cover disabled registration, missing email proof, and unauthorized internal actors.
3. Implement login, online token verification, refresh, and session management. Cover wrong token type, wrong app, another deployment’s token, both expiry deadlines, refresh reuse, concurrent logins at the limit, and database failure.
4. Implement app administration and validate the full flow from two consuming backends. Verify that unauthorized admin requests fail, removal of access invalidates both token types, and restoring access requires a fresh login.

## V1 done when

- [ ] A fresh deployment seeds one working SuperAdmin, its designated app, and only the optional users and grants supplied. Re-running the seed creates no duplicates.
- [ ] A consuming app registers a user publicly with verification off or with accepted backend proof when it is on. An authorized actor can also register a user internally.
- [ ] A consuming app logs in and receives an access and refresh pair. Identity verifies both against live session state without persisting the tokens or their hashes.
- [ ] A consuming app can read and list its user’s sessions, refresh them, revoke one or all, and observe idle and hard expiry. Another device is rejected when the per-app limit is reached.
- [ ] A consuming app can log out the current session and confirm that both token types fail afterward. Other sessions remain usable.
- [ ] The SuperAdmin can register and manage apps and grants. A consuming app can check the user’s access, and revoking a grant or disabling an app invalidates the affected sessions.
