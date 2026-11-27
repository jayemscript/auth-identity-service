# Admin: applications

These read-only routes require the shared API key and a SuperAdmin access token issued for the designated admin app. Set `X-App-Id: {{adminAppSlug}}` and `Authorization: Bearer {{accessToken}}` for every request.

## List apps

`GET {{baseUrl}}/v1/admin/apps`

Returns the consuming apps configured for this deployment. App records are added through the bootstrap seed; this API does not create, update, disable, or delete them.

## Get one app

`GET {{baseUrl}}/v1/admin/apps/{{appId}}`

`appId` accepts the app UUID or its stable slug. Keep a slug unchanged because consuming backends send it in `X-App-Id`; to introduce a distinct app identity, add a new slug to the bootstrap seed.

## Add an app

Add a new entry to `apps` in the bootstrap seed, then rerun bootstrap with its existing `runKey`. Bootstrap inserts missing app slugs and leaves users, settings, and existing app records unchanged; an existing slug with different metadata causes the run to fail. For example:

```json
{
  "slug": "customer-app",
  "name": "Customer App",
  "clientType": "mobile",
  "policy": { "registrationMode": "public" }
}
```

Database protections reject updates and deletes to registered app rows. Adding an app does not automatically grant it to existing users; create those grants through the supported user app-access flow.
