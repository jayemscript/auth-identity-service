# Admin: user sessions

These routes require the shared API key and a SuperAdmin access token for the designated admin app. The `:appId` path parameter accepts an app UUID or slug, and the `:userId` identifies the target user.

## List user sessions

`GET {{baseUrl}}/v1/admin/apps/{{appSlug}}/users/{{userId}}/sessions`

The response message confirms the sessions were found, and `data` contains the user’s sessions for that app with their status and expiry times.

## Get one user session

`GET {{baseUrl}}/v1/admin/apps/{{appSlug}}/users/{{userId}}/sessions/{{sessionId}}`

This returns the matching session or a not-found response.

## Revoke one user session

`DELETE {{baseUrl}}/v1/admin/apps/{{appSlug}}/users/{{userId}}/sessions/{{sessionId}}`

This revokes only the selected session and returns a readable message with `{ "revoked": true }` in `data` when it was active.
