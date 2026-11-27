export const EVENT_CATALOG = [
  {
    name: 'user.created',
    description: 'A user account and its initial app access grant were created.',
    payloadFields: ['userId', 'source'],
  },
  {
    name: 'user.app_access.granted',
    description: 'App access was granted or restored for a user.',
    payloadFields: ['userId', 'source'],
  },
  {
    name: 'user.app_access.revoked',
    description: 'A user’s app access was revoked.',
    payloadFields: ['userId'],
  },
  {
    name: 'session.created',
    description: 'A session was created after a successful login.',
    payloadFields: ['sessionId', 'userId'],
  },
  {
    name: 'session.revoked',
    description: 'A session was revoked by logout, an administrator, or app access revocation.',
    payloadFields: ['sessionId', 'userId', 'reason'],
  },
] as const;

export const DOMAIN_EVENT_TYPES = EVENT_CATALOG.map(({ name }) => name);
export type DomainEventType = (typeof EVENT_CATALOG)[number]['name'];
