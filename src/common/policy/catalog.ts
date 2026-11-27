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
  {
    key: 'registration.mode',
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
    valueType: 'string',
    scope: 'both',
    defaultValue: 'auto_approve',
    availability: 'available',
    allowedValues: ['auto_approve', 'email_verification', 'admin_approval'],
  },
  {
    key: 'auth.methods',
    valueType: 'string_set',
    scope: 'both',
    defaultValue: ['password'],
    availability: 'available',
    allowedValues: ['password', 'magic_link', 'passkey', 'oauth'],
  },
  {
    key: 'mfa.required',
    valueType: 'boolean',
    scope: 'both',
    defaultValue: false,
    availability: 'available',
  },
  {
    key: 'mfa.methods',
    valueType: 'string',
    scope: 'both',
    defaultValue: 'any',
    availability: 'unavailable',
    allowedValues: ['totp', 'sms', 'email_otp', 'webauthn_passkey', 'any'],
  },
  {
    key: 'mfa.grace_period_days',
    valueType: 'number',
    scope: 'both',
    defaultValue: 7,
    availability: 'unavailable',
    allowedValues: [3, 7, 14, 30],
  },
  {
    key: 'mfa.remember_device_days',
    valueType: 'number',
    scope: 'both',
    defaultValue: 0,
    availability: 'unavailable',
    allowedValues: [0, 7, 30, 90],
  },
  {
    key: 'step_up.auth',
    valueType: 'string',
    scope: 'deployment',
    defaultValue: 'off',
    availability: 'unavailable',
    allowedValues: ['off', 'admin_actions', 'billing_and_security', 'always'],
  },
  {
    key: 'session.max_concurrent',
    valueType: 'number',
    scope: 'both',
    defaultValue: 3,
    availability: 'available',
  },
  {
    key: 'session.overflow_policy',
    valueType: 'string',
    scope: 'both',
    defaultValue: 'block_new',
    availability: 'available',
    allowedValues: ['block_new', 'evict_oldest', 'evict_least_active'],
  },
  {
    key: 'session.idle_timeout_minutes',
    valueType: 'number',
    scope: 'both',
    defaultValue: 10080,
    availability: 'available',
    allowedValues: [0, 15, 30, 60, 10080],
  },
  {
    key: 'session.ip_binding',
    valueType: 'string',
    scope: 'both',
    defaultValue: 'off',
    availability: 'unavailable',
    allowedValues: ['off', 'warn_on_change', 'strict_revoke'],
  },
  {
    key: 'token.refresh_rotation',
    valueType: 'string',
    scope: 'deployment',
    defaultValue: 'rotate',
    availability: 'available',
    allowedValues: ['off', 'rotate', 'rotate_with_reuse_detection'],
  },
  {
    key: 'risk.lockout_threshold',
    valueType: 'number',
    scope: 'deployment',
    defaultValue: 0,
    availability: 'unavailable',
    allowedValues: [0, 3, 5, 10],
  },
  {
    key: 'risk.lockout_duration_minutes',
    valueType: 'string',
    scope: 'deployment',
    defaultValue: '15',
    availability: 'unavailable',
    allowedValues: ['5', '15', '60', 'until_admin_unlock'],
  },
  {
    key: 'risk.captcha_mode',
    valueType: 'string',
    scope: 'both',
    defaultValue: 'off',
    availability: 'unavailable',
    allowedValues: ['off', 'after_failed_attempts', 'suspicious_ip', 'always'],
  },
  {
    key: 'risk.new_device_alert',
    valueType: 'string',
    scope: 'both',
    defaultValue: 'off',
    availability: 'unavailable',
    allowedValues: ['off', 'notify_email', 'require_mfa', 'block'],
  },
  {
    key: 'email_verification.required',
    valueType: 'boolean',
    scope: 'both',
    defaultValue: false,
    availability: 'available',
  },
];

export const POLICY_DEFAULTS = Object.fromEntries(
  POLICY_DEFINITIONS.map(({ key, defaultValue }) => [key, defaultValue]),
);
