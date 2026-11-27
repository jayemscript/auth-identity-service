import { EntityManager } from 'typeorm';

type QueryManager = Pick<EntityManager, 'query'>;

export async function findApplicationPolicy(
  manager: QueryManager,
  applicationId: string,
): Promise<Record<string, unknown>> {
  const rows = await manager.query(
    `SELECT key, value FROM apps.application_policy_entries WHERE application_id = $1 ORDER BY key`,
    [applicationId],
  );
  return Object.fromEntries(
    rows.map((row: { key: string; value: unknown }) => [row.key, row.value]),
  );
}

export async function findApplicationPolicies(
  manager: QueryManager,
  applicationIds: string[],
): Promise<Map<string, Record<string, unknown>>> {
  const policies = new Map<string, Record<string, unknown>>();
  if (!applicationIds.length) return policies;
  const rows = await manager.query(
    `SELECT application_id, key, value FROM apps.application_policy_entries
     WHERE application_id = ANY($1::uuid[]) ORDER BY application_id, key`,
    [applicationIds],
  );
  for (const row of rows as Array<{
    application_id: string;
    key: string;
    value: unknown;
  }>) {
    const policy = policies.get(row.application_id) ?? {};
    policy[row.key] = row.value;
    policies.set(row.application_id, policy);
  }
  return policies;
}
