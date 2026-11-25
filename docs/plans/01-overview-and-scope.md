# V1 overview and scope

## Service boundary

Deploy one NestJS service and PostgreSQL database per consuming project. This is a headless service-to-service REST API with no user interface. A deployment has one pool of identities and can serve multiple registered apps. One user account can sign in to any app for which that account has an active grant. Roam Tour can register `traveler-mobile` and `business-dashboard` in the same deployment. An internal HRIS has its own deployment, users, and secrets.

The service owns password credentials, authentication, app-bound sessions, and explicit user-to-app grants. Consuming backends call it over private REST, store the tokens it issues, and use the stable user ID to link their business records. They decide business eligibility and permissions. SuperAdmin and the account-creation flag authorize specific operations inside the identity service.

## Implementation structure

- Use `identity` for accounts and registration, `auth` for tokens and sessions, `apps` for the app registry and grants, and `system` for settings and bootstrap. Each module has its own `.module.ts` and uses the requested `services`, `controllers`, `entities`, `dtos`, `mappers`, `repositories`, and `test` folders as needed. Every folder created for the implementation gets an `index.ts`.
- Give each service class one operation and one method, `execute()`. Keep controllers focused on HTTP, repositories on persistence, and mappers on DTO conversion. Put reusable functions, types, and shared components in `src/common`. Reuse checks for app eligibility, account status, token validation, and session state so routes enforce the same rules.
- Keep the TypeORM data source default schema as `public` and migration history in `public.migrations`. Explicitly qualify domain schemas. Disable automatic schema synchronization. Run migrations one file per transaction with `migrationsTransactionMode: 'each'`, reversible `up` and `down` operations, and the same transaction policy for reverts. Verify that an injected failure rolls back the failed migration and its history entry. [TypeORM migration transaction modes](https://typeorm.io/docs/migrations/faking/)
- Treat this as a fresh V1 deployment. The current ERD describes opaque token hashes and per-app credentials. The implementation should use signed tokens with session state and one deployment API key, so it does not need `auth.sessions.token_hash` or `apps.application_credentials`. The plan leaves the ERD and existing source files untouched.

## Scope and later versions

V1 excludes security logs, event logs, audit logs, messaging, notifications, UI, RBAC, SSO, OIDC, enterprise identity providers, and features outside the flows described here. The service handles authentication and app access grants only. It does not federate identities or authorize business roles and permissions. Session timestamps and grant state support the live API. They do not create a separate activity history.

Later candidates include social login, Excel/CSV import over REST, reusable verification challenges, email delivery, password change and recovery, MFA, and stronger app identity if a deployment needs separate backend trust boundaries. Social login adds an authentication method to existing app access flows. It does not add SSO, OIDC, enterprise identity provider support, or federation between consuming apps. For future email delivery, keep approved HTML/CSS templates in source and store customization data such as brand names, colors, and logo URLs in the database. Consumers can customize branding within the approved template layouts.
