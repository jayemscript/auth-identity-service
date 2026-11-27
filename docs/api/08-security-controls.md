# Security controls and login telemetry

Security controls are enforced during the existing login and registration requests. The service does not expose client-facing endpoints to read audit logs, inspect login attempts, clear account lockouts, or manage IP and email-domain rules.

## Login controls

See [Authentication](./02-authentication.md) for the `POST /v1/auth/login` request and token response.

- Login IP rules apply to the app identified by `X-App-Id`. A denied request returns `403 Forbidden` with code `IP_RULE_DENIED`.
- If the app's effective `risk.lockout_threshold` is greater than zero, failed passwords count within a 15-minute window. A successful password check or an expired lock starts a new counting period.
- Email and username aliases for a known account share the same failed-attempt counter. Unknown identifiers are stored as keyed digests rather than raw identifiers.
- Once the threshold creates an active lockout, login returns the same generic `401 Unauthorized` response used for incorrect credentials. Retries during the lock do not extend it.
- `risk.lockout_duration_minutes` supports 5, 15, or 60 minutes. The staged `until_admin_unlock` catalog value currently uses a 15-minute lock because an administrative unlock workflow is not available.
- Lockout state is app-scoped. A lock in one app does not lock the account in other apps.

The default threshold is `0`, which disables failed-password lockout unless an operator configures a nonzero value for that app. App policy settings are managed by service operators, not through a consuming-app API.

## Registration controls

See [Registration](./01-registration.md) for the public and internal registration requests. Both routes apply the target app's IP and email-domain rules before creating the account.

| HTTP status | Error code | Meaning |
| --- | --- | --- |
| `403` | `IP_RULE_DENIED` | The request IP is denied or does not match an active allow list. |
| `403` | `EMAIL_DOMAIN_RULE_DENIED` | The normalized email domain is denied or does not match an active allow list. |
| `503` | — | The security-rule lookup failed. The request was not permitted to continue. |

Deny rules take precedence. When active allow rules exist for an operation, a request must match at least one allow rule. Email-domain matching is exact after normalization. Rule configuration is developer-managed through `make security-rules RULES_FILE=...`; consuming apps cannot change these rules through the API.

## Audit and security events

The service writes audit records and security telemetry internally as state changes occur. These records are not exposed as client-facing API resources in this phase. New device recognition is recorded internally, while device alerts, MFA challenges, and device-based blocking are not implemented.
