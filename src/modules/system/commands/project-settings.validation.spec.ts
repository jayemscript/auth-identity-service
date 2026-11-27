import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { POLICY_DEFINITIONS } from '../../../common/policy/catalog';
import { validateProjectSettings } from './project-settings.validation';

describe('auth.methods policy catalog', () => {
  const definition = POLICY_DEFINITIONS.find(({ key }) => key === 'auth.methods');

  it('matches the initial migration default and allowed values', () => {
    const migration = readFileSync(
      resolve(__dirname, '../../../database/migrations/1796000000000-AddPolicyCatalog.ts'),
      'utf8',
    );
    const seededDefinition = migration.match(/\('auth\.methods','string_set','both','(\[[^']+\])','available'\)/);
    const seededValues = migration.match(/SELECT 'auth\.methods', method\.value\s+FROM jsonb_array_elements\('(\[[^']+\])'::jsonb\) AS method\(value\)/);

    expect(definition?.defaultValue).toEqual(['password']);
    expect(definition?.allowedValues).toEqual(['password', 'magic_link', 'passkey', 'oauth', 'any']);
    expect(seededDefinition).not.toBeNull();
    expect(seededValues).not.toBeNull();
    expect(JSON.parse(seededDefinition![1])).toEqual(definition?.defaultValue);
    expect(JSON.parse(seededValues![1])).toEqual(definition?.allowedValues);
  });

  it('accepts concrete methods and any, and rejects ambiguous or unknown names', () => {
    expect(() => validateProjectSettings({ 'auth.methods': ['password'] })).not.toThrow();
    expect(() =>
      validateProjectSettings({ 'auth.methods': ['password', 'magic_link'] }),
    ).not.toThrow();
    expect(() => validateProjectSettings({ 'auth.methods': ['any'] })).not.toThrow();
    expect(() => validateProjectSettings({ 'auth.methods': ['any', 'password'] })).toThrow(
      'auth.methods must contain supported values',
    );
    expect(() => validateProjectSettings({ 'auth.methods': ['unknown'] })).toThrow(
      'auth.methods must contain supported values',
    );
  });
});
