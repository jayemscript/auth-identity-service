# Admin: applications

These routes require the shared API key and a SuperAdmin access token issued for the designated admin app. Set `X-App-Id: {{adminAppSlug}}` and `Authorization: Bearer {{accessToken}}` for every request in this file.

## Create app

`POST {{baseUrl}}/v1/admin/apps`

```json
{
  "slug": "courier-app",
  "name": "Courier App",
  "clientType": "mobile",
  "policy": {
    "registrationMode": "public",
    "emailVerificationRequired": false,
    "idleTimeoutSeconds": 604800,
    "maxConcurrentSessions": 3
  }
}
```

Allowed registration modes are `public`, `operator_only`, and `disabled`; app slug must be lowercase letters, digits, dots, underscores, or hyphens. The response includes a plain-language message and the created app, including its ID and status, in `data`.

## List and get apps

`GET {{baseUrl}}/v1/admin/apps` lists apps. `GET {{baseUrl}}/v1/admin/apps/{{appSlug}}` returns one app; `appId` accepts the app UUID or slug.

## Update app

`PATCH {{baseUrl}}/v1/admin/apps/{{appSlug}}`

```json
{
  "name": "Courier App",
  "status": "active",
  "policy": { "registrationMode": "operator_only" }
}
```

You may update `name`, `clientType`, `status` (`active` or `disabled`), and policy values. Disabling an app revokes its active sessions, and the designated admin app cannot be disabled.
