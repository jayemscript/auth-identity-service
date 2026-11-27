# Registration

Both endpoints create an identity and grant access to the app identified by `X-App-Id`. Registration mode resolves from the app override, then deployment settings, then the policy catalog default. `public` permits self-service registration, `operator_only` permits authorized operator creation, `hybrid` permits both, `invite_only` blocks both endpoints until invitation redemption is implemented, and `disabled` blocks registration.

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

`username`, `phone`, and `verifiedEmail` are optional; password length is 8–128 characters. When the effective account approval policy requires email verification, both registration routes require `verifiedEmail` to match the normalized email. Send it only after your backend has verified ownership.

App-scoped registration IP and email-domain rules are checked before an account is created. A denied network returns `403 Forbidden` with code `IP_RULE_DENIED`. A denied email domain returns `403 Forbidden` with code `EMAIL_DOMAIN_RULE_DENIED`. A deny rule takes precedence over an allow rule. If an app has active allow rules, a request must match one.

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

The same app-scoped IP and email-domain checks apply to internal registration. Rule management is restricted to developers and is not an API endpoint for consuming apps.
