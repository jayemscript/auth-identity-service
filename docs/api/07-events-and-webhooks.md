# Events and webhook subscriptions

## Client backend integration status

There are no client-facing API endpoints to create webhook endpoints, change subscriptions, list events, or request a delivery. Developers provision an app's HTTPS receiver and subscriptions with `make webhook-endpoints ENDPOINTS_FILE=...`. This command is operational configuration, not part of a consuming app's HTTP API.

The service writes domain events and matching `pending` delivery rows in the same database transaction as the identity change. Outbound HTTP delivery, retries, and delivery-status APIs are not implemented in this phase. A receiver URL configured today will not yet receive requests. Keep the receiver prepared for the event contract below, but do not rely on delivery until outbound delivery is implemented.

Events are app-scoped. An endpoint only receives queued deliveries for events belonging to its configured app and for event names in its subscription list. Payloads use schema version 1 and contain the event ID, name, app ID, aggregate type and ID, creation time, and event-specific fields below. They do not contain credentials, access tokens, refresh tokens, or raw login identifiers.

Webhook subscriptions use the exact, case-sensitive event names in the catalog below. These are the only event names supported by this service. The same catalog is exported in code and stored in `events.event_catalog`; endpoint provisioning rejects unknown names.

| Event name | Emitted when | Payload fields |
| --- | --- | --- |
| `user.created` | A user account is created through registration. | `userId`, `source` |
| `user.app_access.granted` | App access is granted or restored. Initial registration also emits this event. | `userId`; `source` is included for initial registration. |
| `user.app_access.revoked` | App access is revoked for a user. | `userId` |
| `session.created` | Login creates a session. | `sessionId`, `userId` |
| `session.revoked` | A session is revoked by logout, an administrator, or app access revocation. | `sessionId`, `userId`; `reason` is included for app access revocation. |

Event records include an event ID, event name, schema version, app ID, aggregate type and ID, creation time, and the listed payload. Payloads contain identifiers and transition metadata, not credentials, tokens, or raw login details.

Subscribe by placing the supported names in an endpoint’s `subscriptions` array in [`webhook-endpoints.example.json`](../examples/webhook-endpoints.example.json). Configure the app-specific HTTPS receiver URL and secret reference for your deployment, then run `make webhook-endpoints ENDPOINTS_FILE=...` after migrations and bootstrap. This phase stores events and queues matching delivery rows. It does not send HTTP requests to the receiver yet.
