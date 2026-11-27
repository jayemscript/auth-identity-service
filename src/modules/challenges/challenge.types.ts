export const CHALLENGE_TYPES = [
  'password-reset',
  'forgotten-credentials',
  'email-verification',
  'otp-verification',
  'security-alert',
  'invitation',
  'magic-link',
  'mfa',
] as const;
export type ChallengeType = (typeof CHALLENGE_TYPES)[number];
export interface ChallengeHandler {
  readonly type: ChallengeType;
}
export const CHALLENGE_HANDLERS = Symbol('CHALLENGE_HANDLERS');
