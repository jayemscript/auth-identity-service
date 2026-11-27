import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ApplicationMapper, ApplicationRow } from '../mappers/application.mapper';
import { findApplicationPolicies } from './application-policy.repository';
import { PolicyResolverService } from '../../policies';

type DbManager = Pick<EntityManager, 'query'>;

@Injectable()
export class ApplicationRepository {
  constructor(
    private readonly dataSource: DataSource,
    private readonly policyResolver: PolicyResolverService,
  ) {}

  async findAll(manager: DbManager = this.dataSource.manager) {
    const rows = (await manager.query(
      `SELECT id, slug, name, client_type, status, created_at, updated_at FROM apps.applications ORDER BY slug`,
    )) as Array<Omit<ApplicationRow, 'policy'>>;
    const policies = await findApplicationPolicies(
      manager,
      rows.map((row) => row.id),
    );
    return Promise.all(rows.map(async (row) =>
      ApplicationMapper.toResponse({
        ...row,
        policy: policies.get(row.id) ?? {},
        effective_policy: await this.policyResolver.execute(manager, row.id),
      }),
    ));
  }

  async findByIdOrSlug(
    appId: string,
    manager: DbManager = this.dataSource.manager,
  ) {
    const [row] = await manager.query(
      `SELECT id, slug, name, client_type, status, created_at, updated_at FROM apps.applications WHERE id::text = $1 OR slug = $1`,
      [appId],
    );
    if (!row) return null;
    const policies = await findApplicationPolicies(manager, [row.id]);
    return ApplicationMapper.toResponse({
      ...row,
      policy: policies.get(row.id) ?? {},
      effective_policy: await this.policyResolver.execute(manager, row.id),
    } as ApplicationRow);
  }
}
