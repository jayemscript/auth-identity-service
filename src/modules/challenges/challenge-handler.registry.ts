import { Inject, Injectable } from '@nestjs/common';
import { CHALLENGE_HANDLERS, ChallengeHandler, ChallengeType } from './challenge.types';

@Injectable()
export class ChallengeHandlerRegistry {
  private readonly handlers = new Map<ChallengeType, ChallengeHandler>();
  constructor(@Inject(CHALLENGE_HANDLERS) initial: ChallengeHandler[]) {
    for (const handler of initial) this.register(handler);
  }
  register(handler: ChallengeHandler): void { this.handlers.set(handler.type, handler); }
  get(type: ChallengeType): ChallengeHandler | undefined { return this.handlers.get(type); }
}

export class InvitationChallengeHandler implements ChallengeHandler {
  readonly type = 'invitation' as const;
  // TODO(deferred): Wire to Better Auth account creation and organization membership.
}
export class MagicLinkChallengeHandler implements ChallengeHandler {
  readonly type = 'magic-link' as const;
  // TODO(deferred): Wire to Better Auth sign-in and session creation.
}
export class MfaChallengeHandler implements ChallengeHandler {
  readonly type = 'mfa' as const;
  // TODO(deferred): Wire to the future MFA module's factor verification.
}
