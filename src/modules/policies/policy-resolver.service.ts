import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { POLICY_DEFAULTS } from '../../common/policy/catalog';

type QueryManager = Pick<EntityManager, 'query'>;

@Injectable()
export class PolicyResolverService {
  async execute(manager: QueryManager, applicationId: string) {
    const [appRows, globalRows] = await Promise.all([
      manager.query(
        `SELECT key, value FROM apps.application_policy_entries WHERE application_id = $1`,
        [applicationId],
      ),
      manager.query(
        `SELECT key, value FROM system.settings WHERE application_id IS NULL`,
      ),
    ]);
    const appValues = Object.fromEntries(
      appRows.map((row: { key: string; value: unknown }) => [row.key, row.value]),
    );
    const globalValues = Object.fromEntries(
      globalRows.map((row: { key: string; value: unknown }) => [row.key, row.value]),
    );
    return Object.fromEntries(
      Object.entries(POLICY_DEFAULTS).map(([key, fallback]) => [
        key,
        appValues[key] ?? globalValues[key] ?? fallback,
      ]),
    );
  }
}
