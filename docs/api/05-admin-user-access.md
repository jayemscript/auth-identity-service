# Admin: user access and config

These routes require the shared API key and a SuperAdmin access token for the designated admin app. Use app UUIDs or slugs in `:appId`, and user IDs in `:userId`.

## Grant user access to an app

`PUT {{baseUrl}}/v1/admin/apps/{{appSlug}}/users/{{userId}}/access`

No request body is needed. This adds or restores the user’s grant to the selected app.

## Revoke user access

`DELETE {{baseUrl}}/v1/admin/apps/{{appSlug}}/users/{{userId}}/access`

No request body is needed. Revoking the grant also revokes the user’s sessions for that app; the designated SuperAdmin admin-app grant is protected.

## Update user config

`PATCH {{baseUrl}}/v1/admin/users/{{userId}}/config`

```json
{
  "canCreateUsers": true,
  "sessionLimitOverride": 5
}
```

Both fields are optional; `sessionLimitOverride` must be a positive integer or `null` to clear it. Set `canCreateUsers` to `true` for an operator who should be able to call internal registration.
