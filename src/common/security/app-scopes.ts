import { SetMetadata } from '@nestjs/common';

export const APP_SCOPES = 'application-scopes';

export const RequireAppScopes = (...scopes: string[]) =>
  SetMetadata(APP_SCOPES, scopes);
