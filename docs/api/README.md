# Postman API guide

These files document the V1 HTTP API so it can be called directly from Postman without a consumer application. Import the service’s Postman environment values below, then follow the workflow in order.

## Environment values

| Variable       | Example                      | Purpose                                                   |
| -------------- | ---------------------------- | --------------------------------------------------------- |
| `baseUrl`      | `http://localhost:7000`      | Local service URL; use your deployed URL when applicable. |
| `apiKey`       | credential ID and secret | App credential issued for this BFF. |
| `healthApiKey` | value of `API_KEY` in `.env` | Shared key accepted by `GET /health` only. |
| `appSlug`      | `customer-app`               | Active app slug used in `X-App-Id`.                       |
| `adminAppSlug` | `admin-dashboard`            | Designated admin app slug.                                |
| `userId`       | `data.userId`                | User ID for access checks and admin operations.           |
| `accessToken`  | `data.accessToken`           | Signed access token for protected user/admin routes.      |
| `refreshToken` | `data.refreshToken`          | Signed refresh token for token rotation.                  |
| `sessionId`    | `data.sessionId`             | Session identifier returned by login.                     |

Set `Content-Type: application/json` for requests with JSON bodies. For `/v1` requests send the app credential as `X-API-Key: {{apiKey}}` and its app slug as `X-App-Id: {{appSlug}}`; protected routes also need `Authorization: Bearer {{accessToken}}`. `GET /.well-known/jwks.json` is public and returns the access-token verification keys.

Successful responses use `{ "message": "...", "data": ... }`; read IDs, tokens, and result fields from `data`. Errors include a plain-language `message`, HTTP status, and an optional machine-readable `code`.

For example, the session limit returns HTTP `409` with `message: "You have reached the maximum number of active sessions for this app. End another session before signing in again."` and `code: "SESSION_LIMIT_REACHED"`.

## Suggested test flow

1. Check `GET {{baseUrl}}/health` with `X-API-Key: {{healthApiKey}}`.
2. Register using [Registration](./01-registration.md), then save `data.userId` from the response.
3. Log in using [Authentication](./02-authentication.md), then save `data.accessToken`, `data.refreshToken`, and `data.sessionId`.
4. Try session and app access routes using [Sessions and app access](./03-sessions-and-access.md).
5. Use admin routes only after logging in as the bootstrapped SuperAdmin with `X-App-Id: {{adminAppSlug}}`.

Issue separate credentials for `merchant-bff`, `customer-bff`, and the internal admin client with `make issue-app-credential`. The credential is printed once as `id.secret`; store it in a private Postman environment and never export it. Postman can simulate each backend by selecting its credential and matching app slug.

The server’s Swagger UI is available at `{{baseUrl}}/docs` when `SWAGGER_ENABLED=true`. Better Auth’s internal routes are not part of this API and are not mounted.

## Endpoints

| Method      | Path                                                      | Auth                                                      |
| ----------- | --------------------------------------------------------- | --------------------------------------------------------- |
| GET         | `/health`                                                 | API key                                                   |
| GET         | `/.well-known/jwks.json`                                  | Public signing keys                                       |
| POST        | `/v1/registration/public`                                 | API key                                                   |
| POST        | `/v1/registration/internal`                               | API key + user access token with user-creation permission |
| POST        | `/v1/auth/login`                                          | API key                                                   |
| POST        | `/v1/auth/verify`                                         | API key                                                   |
| POST        | `/v1/auth/refresh`                                        | API key                                                   |
| POST        | `/v1/auth/logout`                                         | API key + access token                                    |
| GET, DELETE | `/v1/sessions`                                            | API key + access token                                    |
| GET, DELETE | `/v1/sessions/:sessionId`                                 | API key + access token                                    |
| POST        | `/v1/app-access/check`                                    | API key                                                   |
| GET         | `/v1/admin/apps`                                          | API key + SuperAdmin access token                         |
| GET         | `/v1/admin/apps/:appId`                                   | API key + SuperAdmin access token                         |
| PUT, DELETE | `/v1/admin/apps/:appId/users/:userId/access`              | API key + SuperAdmin access token                         |
| PATCH       | `/v1/admin/users/:userId/config`                          | API key + SuperAdmin access token                         |
| GET         | `/v1/admin/apps/:appId/users/:userId/sessions`            | API key + SuperAdmin access token                         |
| GET, DELETE | `/v1/admin/apps/:appId/users/:userId/sessions/:sessionId` | API key + SuperAdmin access token                         |
