# Registration

Both endpoints create an identity and grant access to the app identified by `X-App-Id`. Public registration works only when that app’s registration mode is `public`; internal registration requires a signed-in actor who has permission to create users.

## Public registration

`POST {{baseUrl}}/v1/registration/public`

Headers: `X-API-Key: {{apiKey}}`, `X-App-Id: {{appSlug}}`, `Content-Type: application/json`.

```json
{
  "name": "Alex Rivera",
  "email": "alex@example.com",
  "username": "alex.rivera",
  "password": "ChangeMe123!",
  "phone": "+15551234567"
}
```

`username`, `phone`, and `verifiedEmail` are optional; password length is 8–128 characters. `verifiedEmail` is only accepted as proof when it exactly matches the email and the consuming app requires email verification, so only send it after your backend has verified ownership.

Example response:

```json
{
  "message": "Your account was created. You can now sign in to this app.",
  "data": { "userId": "f3e9c2f0-7f6d-4db5-ae3d-31ce9bd83b5a" }
}
```

## Internal registration

`POST {{baseUrl}}/v1/registration/internal`

Use the same JSON body as public registration. Set `Authorization: Bearer {{accessToken}}` for an actor in the same app; the actor must have `canCreateUsers` enabled in their user config. The token’s app must match `X-App-Id`, so a SuperAdmin token issued for `internal-admin` cannot be sent with another app’s slug; sign in to the target app with an authorized operator account instead. A mismatch returns `403 Forbidden` with code `TOKEN_APP_MISMATCH`.
