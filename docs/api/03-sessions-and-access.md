# Sessions and app access

Session routes require the API key, `X-App-Id`, and the current user’s access token. App access checks are backend-to-backend calls and do not require a user token.

## List this user’s sessions

`GET {{baseUrl}}/v1/sessions?status=active&limit=20&offset=0`

`status` can be `active`, `revoked`, `expired`, or `all`; `limit` is 1–100 and `offset` is zero or greater. The session list is in `data`, with each entry showing its ID, status, creation time, refresh time, idle expiry, and hard expiry.

## Get one session

`GET {{baseUrl}}/v1/sessions/{{sessionId}}`

Only sessions belonging to the current user and app are returned.

## Revoke sessions

`DELETE {{baseUrl}}/v1/sessions/{{sessionId}}` revokes one of the current user’s sessions. `DELETE {{baseUrl}}/v1/sessions` revokes all of the current user’s sessions for the selected app.

## Check app access

`POST {{baseUrl}}/v1/app-access/check`

```json
{ "userId": "{{userId}}" }
```

The selected app comes from `X-App-Id`; `data.allowed` is `true` or `false`, and the response message explains the result in plain language.
