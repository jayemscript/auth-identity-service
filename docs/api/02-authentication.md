# Authentication

All authentication requests require the shared API key and an active app slug in `X-App-Id`. Login creates a server-side session and returns signed V1 access and refresh tokens; the internal Better Auth session token is never returned.

## Login

`POST {{baseUrl}}/v1/auth/login`

```json
{
  "identifier": "alex@example.com",
  "password": "ChangeMe123!",
  "deviceId": "optional-bff-generated-device-id"
}
```

`identifier` may be an email address or username, and the account must have active access to `{{appSlug}}`. `deviceId` is optional. A BFF may generate a random base64url identifier of 22–128 characters and retain it for that browser or device. Send the same value on later logins from that device. The service stores only an app- and user-scoped digest and links recognized devices to sessions. Do not use an email, username, hardware identifier, or other personal data as the device ID. Save `data.sessionId`, `data.accessToken`, and `data.refreshToken` as Postman environment values.

If the password is valid but the account has no active grant for this app, login returns `403 Forbidden` with a message explaining how to request access. Invalid credentials return `401 Unauthorized` with a plain-language message.

When an app has login IP rules, requests outside the allowed networks return `403` with code `IP_RULE_DENIED`. When app-specific failed-login lockout is enabled, failed password attempts for the same account count together whether the caller uses its email or username. An active lockout returns the same generic `401` response as invalid credentials. The threshold and lock duration are app policy settings managed by the service operator. A `deviceId` format error returns `400`.

Example response shape:

```json
{
  "message": "Welcome, Alex Rivera! You are signed in.",
  "data": {
    "sessionId": "session-id",
    "accessToken": "signed-access-token",
    "refreshToken": "signed-refresh-token",
    "accessTokenExpiresAt": "2026-11-25T06:00:00.000Z",
    "refreshTokenExpiresAt": "2026-12-02T05:45:00.000Z"
  }
}
```

## Verify token

`POST {{baseUrl}}/v1/auth/verify`

```json
{
  "token": "{{accessToken}}",
  "tokenType": "access"
}
```

Use `tokenType: "refresh"` to check a refresh token. `data.active` indicates whether it is still valid; when active, `data` also includes the user, app, session, and expiry details.

## Refresh tokens

`POST {{baseUrl}}/v1/auth/refresh`

```json
{ "refreshToken": "{{refreshToken}}" }
```

Save both replacement tokens from `data` immediately; refresh tokens rotate, so reusing an earlier generation is rejected.

When the app’s active-session limit is reached, `session.overflow_policy` controls login. `block_new` returns `409 Conflict` with code `SESSION_LIMIT_REACHED`. `evict_oldest` revokes the earliest-created active session. `evict_least_active` revokes the session with the oldest successful refresh, falling back to its creation time when it has never been refreshed. Each revoked session is recorded as a `session.revoked` event with reason `session_overflow`.

Live token verification and protected service routes reject evicted sessions immediately. Backends that verify access-token signatures offline cannot see a revocation until the token expires, so use live verification when immediate revocation matters.

Apps can set `session.ip_binding` to `strict_revoke` to bind each session to the client IP recorded at login. A later request from a different IP revokes that session and is rejected. A session created before IP binding, or one without a valid recorded IP, is revoked on its first otherwise valid request with a usable IP. Apps using this policy must provide a client IP on login. Configure `TRUST_PROXY_HOPS` for the actual network path and have the trusted BFF overwrite forwarded IP headers. Network changes can require the user to sign in again. `off` remains the default. `warn_on_change` does not yet send alerts.

Offline JWT signature checks cannot detect IP changes or session revocation. Use live `/v1/auth/verify` for decisions that must enforce IP binding.

## Logout

`POST {{baseUrl}}/v1/auth/logout`

Send `Authorization: Bearer {{accessToken}}` with no request body. It revokes the current session for the current app and includes a `revoked` count in `data`.
