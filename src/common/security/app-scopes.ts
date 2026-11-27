import { SetMetadata } from '@nestjs/common';

export const APP_SCOPES = 'application-scopes';

export const RequireAppScopes = (...scopes: string[]) =>
  SetMetadata(APP_SCOPES, scopes);

export function hasRequiredScopes(
  assignedScopes: readonly string[],
  requiredScopes: readonly string[],
): boolean {
  return requiredScopes.every((scope) => assignedScopes.includes(scope));
}
