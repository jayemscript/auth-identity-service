# Authentication

All authentication requests require the shared API key and an active app slug in `X-App-Id`. Login creates a server-side session and returns signed V1 access and refresh tokens; the internal Better Auth session token is never returned.

## Login

`POST {{baseUrl}}/v1/auth/login`

```json
{
  "identifier": "alex@example.com",
  "password": "ChangeMe123!"
}
```

`identifier` may be an email address or username, and the account must have active access to `{{appSlug}}`. Save `data.sessionId`, `data.accessToken`, and `data.refreshToken` as Postman environment values.

If the password is valid but the account has no active grant for this app, login returns `403 Forbidden` with a message explaining how to request access. Invalid credentials return `401 Unauthorized` with a plain-language message.

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

If the app’s active-session limit is reached, login returns `409 Conflict` with a readable `message` and the code `SESSION_LIMIT_REACHED`; end an existing session before signing in again.

## Logout

`POST {{baseUrl}}/v1/auth/logout`

Send `Authorization: Bearer {{accessToken}}` with no request body. It revokes the current session for the current app and includes a `revoked` count in `data`.
