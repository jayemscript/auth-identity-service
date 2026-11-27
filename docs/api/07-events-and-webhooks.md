# Events and webhook subscriptions

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
