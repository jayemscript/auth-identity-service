import { POLICY_DEFINITIONS } from '../../../common/policy/catalog';

export function validateProjectSettings(settings: Record<string, unknown>): void {
  const definitions = new Map(
    POLICY_DEFINITIONS.map((definition) => [definition.key, definition]),
  );
  for (const [key, value] of Object.entries(settings)) {
    const definition = definitions.get(key);
    if (!definition || definition.availability === 'unavailable')
      throw new Error(`Unsupported or unavailable project setting ${key}`);
    const allowed = definition.allowedValues;
    if (allowed && definition.valueType !== 'string_set' && !allowed.includes(value))
      throw new Error(`Unsupported value for project setting ${key}`);
    if (definition.valueType === 'number' && !Number.isInteger(value))
      throw new Error(`${key} must be an integer`);
    if (definition.valueType === 'boolean' && typeof value !== 'boolean')
      throw new Error(`${key} must be boolean`);
    if (
      definition.valueType === 'string_set' &&
      (!Array.isArray(value) ||
        value.length === 0 ||
        value.some((entry) => !allowed?.includes(entry)))
    )
      throw new Error(`${key} must contain supported values`);
  }
}
