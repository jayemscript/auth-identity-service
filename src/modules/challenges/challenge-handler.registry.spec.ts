import { ChallengeHandlerRegistry, InvitationChallengeHandler } from './challenge-handler.registry';
import { ChallengeHandler } from './challenge.types';

describe('ChallengeHandlerRegistry', () => {
  it('loads defaults and allows a future module to register a handler', () => {
    const registry = new ChallengeHandlerRegistry([new InvitationChallengeHandler()]);
    const handler: ChallengeHandler = { type: 'mfa' };
    registry.register(handler);
    expect(registry.get('invitation')).toBeInstanceOf(InvitationChallengeHandler);
    expect(registry.get('mfa')).toBe(handler);
  });
});
