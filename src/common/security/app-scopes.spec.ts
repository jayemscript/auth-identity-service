import { hasRequiredScopes } from './app-scopes';

describe('hasRequiredScopes', () => {
  it('accepts a credential when all required scopes are assigned', () => {
    expect(hasRequiredScopes(['auth:login', 'tokens:verify'], ['auth:login'])).toBe(true);
  });

  it('rejects an empty assigned scope set when a route requires a scope', () => {
    expect(hasRequiredScopes([], ['auth:login'])).toBe(false);
  });

  it('accepts routes that require no scopes', () => {
    expect(hasRequiredScopes([], [])).toBe(true);
  });
});
