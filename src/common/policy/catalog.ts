export type PolicyAvailability = 'available' | 'unavailable';

export interface PolicyDefinition {
  key: string;
  valueType: 'string' | 'number' | 'boolean' | 'string_set';
  scope: 'deployment' | 'application' | 'both';
  defaultValue: unknown;
  availability: PolicyAvailability;
  allowedValues?: readonly unknown[];
}

export const POLICY_DEFINITIONS: readonly PolicyDefinition[] = [
  // Runtime status notes describe behavior currently enforced by services.
  // Keep availability and runtime support separate as policies are implemented.
  {
    key: 'registration.mode',
    // Partial: public, operator_only, hybrid, and disabled are enforced. invite_only has no flow yet.
    valueType: 'string',
    scope: 'both',
    defaultValue: 'disabled',
    availability: 'available',
    allowedValues: [
      'public',
      'operator_only',
      'hybrid',
      'invite_only',
      'disabled',
    ],
  },
  {
    key: 'account.approval',
    // Partial: email_verification is enforced. auto_approve is the current path; admin_approval has no workflow yet.
    valueType: 'string',
    scope: 'both',
    defaultValue: 'auto_approve',
    availability: 'available',
    allowedValues: ['auto_approve', 'email_verification', 'admin_approval'],
  },
  {
    key: 'auth.methods',
    // Consumers interpret "any" according to the methods their app and client support.
    valueType: 'string_set',
    scope: 'both',
    defaultValue: ['password'],
    availability: 'available',
    allowedValues: ['password', 'magic_link', 'passkey', 'oauth', 'any'],
  },
  {
    key: 'mfa.required',
    // Catalog only: MFA enrollment and challenge flows are not implemented.
    valueType: 'boolean',
    scope: 'both',
    defaultValue: false,
    availability: 'available',
  },
  {
    key: 'mfa.methods',
    // Catalog only: MFA methods are not implemented.
    valueType: 'string',
    scope: 'both',
    defaultValue: 'any',
    availability: 'available',
    allowedValues: ['totp', 'sms', 'email_otp', 'webauthn_passkey', 'any'],
  },
  {
    key: 'mfa.grace_period_days',
    // Catalog only: MFA enrollment and grace periods are not implemented.
    valueType: 'number',
    scope: 'both',
    defaultValue: 7,
    availability: 'available',
    allowedValues: [3, 7, 14, 30],
  },
  {
    key: 'mfa.remember_device_days',
    // Catalog only: trusted-device MFA behavior is not implemented.
    valueType: 'number',
    scope: 'both',
    defaultValue: 0,
    availability: 'available',
    allowedValues: [0, 7, 30, 90],
  },
  {
    key: 'step_up.auth',
    // Catalog only: step-up authentication is not implemented.
    valueType: 'string',
    scope: 'deployment',
    defaultValue: 'off',
    availability: 'available',
    allowedValues: ['off', 'admin_actions', 'billing_and_security', 'always'],
  },
  {
    key: 'session.max_concurrent',
    // Implemented: login blocks a new session when this app's active-session cap is reached.
    valueType: 'number',
    scope: 'both',
    defaultValue: 3,
    availability: 'available',
  },
  {
    key: 'session.overflow_policy',
    // Login revokes sessions by creation time or last refresh when an app reaches its cap.
    valueType: 'string',
    scope: 'both',
    defaultValue: 'block_new',
    availability: 'available',
    allowedValues: ['block_new', 'evict_oldest', 'evict_least_active'],
  },
  {
    key: 'session.idle_timeout_minutes',
    // Implemented: login and refresh enforce the app's idle expiry, bounded by the hard expiry.
    valueType: 'number',
    scope: 'both',
    defaultValue: 10080,
    availability: 'available',
  },
  {
    key: 'session.ip_binding',
    // Catalog only: session IP binding and change handling are not implemented.
    valueType: 'string',
    scope: 'both',
    defaultValue: 'off',
    availability: 'available',
    allowedValues: ['off', 'warn_on_change', 'strict_revoke'],
  },
  {
    key: 'token.refresh_rotation',
    // Catalog only: refresh-token rotation behavior is not selected by this policy yet.
    valueType: 'string',
    scope: 'deployment',
    defaultValue: 'rotate',
    availability: 'available',
    allowedValues: ['off', 'rotate', 'rotate_with_reuse_detection'],
  },
  {
    key: 'risk.lockout_threshold',
    // Implemented: failed password attempts are counted per app and account. Zero disables lockout.
    valueType: 'number',
    scope: 'both',
    defaultValue: 0,
    availability: 'available',
    allowedValues: [0, 3, 5, 10],
  },
  {
    key: 'risk.lockout_duration_minutes',
    // Partial: 5, 15, and 60 minute locks are enforced. until_admin_unlock currently falls back to 15 minutes.
    valueType: 'string',
    scope: 'both',
    defaultValue: '15',
    availability: 'available',
    allowedValues: ['5', '15', '60', 'until_admin_unlock'],
  },
  {
    key: 'risk.captcha_mode',
    // Catalog only: CAPTCHA challenges are not implemented.
    valueType: 'string',
    scope: 'both',
    defaultValue: 'off',
    availability: 'available',
    allowedValues: ['off', 'after_failed_attempts', 'suspicious_ip', 'always'],
  },
  {
    key: 'risk.new_device_alert',
    // Partial: new-device recognition is recorded. Alerts, MFA challenges, and blocking are not implemented.
    valueType: 'string',
    scope: 'both',
    defaultValue: 'off',
    availability: 'available',
    allowedValues: ['off', 'notify_email', 'require_mfa', 'block'],
  },
  {
    key: 'email_verification.required',
    // Partial: registration requires the caller-supplied verifiedEmail proof when enabled; delivery and verification are external.
    valueType: 'boolean',
    scope: 'both',
    defaultValue: false,
    availability: 'available',
  },
];

export const POLICY_DEFAULTS = Object.fromEntries(
  POLICY_DEFINITIONS.map(({ key, defaultValue }) => [key, defaultValue]),
);
