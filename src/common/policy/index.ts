export type RegistrationMode = 'public' | 'operator_only' | 'disabled';

export interface EffectiveSessionPolicy {
  registrationMode: RegistrationMode;
  idleTimeoutSeconds: number;
  maxConcurrentSessions: number;
}

export function resolveSessionPolicy(input: {
  app?: Partial<EffectiveSessionPolicy>;
  project?: Partial<EffectiveSessionPolicy>;
  accessLifetimeSeconds: number;
  hardLifetimeSeconds: number;
  userSessionLimit?: number | null;
}): EffectiveSessionPolicy {
  const result: EffectiveSessionPolicy = {
    registrationMode:
      input.app?.registrationMode ??
      input.project?.registrationMode ??
      'public',
    idleTimeoutSeconds:
      input.app?.idleTimeoutSeconds ??
      input.project?.idleTimeoutSeconds ??
      604800,
    maxConcurrentSessions:
      input.userSessionLimit ??
      input.app?.maxConcurrentSessions ??
      input.project?.maxConcurrentSessions ??
      3,
  };
  if (
    !Number.isInteger(result.idleTimeoutSeconds) ||
    result.idleTimeoutSeconds < input.accessLifetimeSeconds ||
    result.idleTimeoutSeconds > input.hardLifetimeSeconds
  ) {
    throw new RangeError(
      'Effective idle timeout must be between token lifetimes',
    );
  }
  if (
    !Number.isInteger(result.maxConcurrentSessions) ||
    result.maxConcurrentSessions < 1
  ) {
    throw new RangeError('Concurrent session limit must be a positive integer');
  }
  return result;
}
