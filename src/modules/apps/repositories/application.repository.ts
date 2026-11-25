import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ApplicationMapper } from '../mappers/application.mapper';

type DbManager = Pick<EntityManager, 'query'>;

@Injectable()
export class ApplicationRepository {
  constructor(private readonly dataSource: DataSource) {}

  async create(input: Record<string, unknown>) {
    const [row] = await this.dataSource.query(
      `INSERT INTO apps.applications (id, slug, name, client_type, status, policy)
       VALUES (gen_random_uuid(), lower($1), $2, $3, 'active', $4)
       RETURNING id, slug, name, client_type, status, policy, created_at, updated_at`,
      [input.slug, input.name, input.clientType, input.policy ?? {}],
    );
    return ApplicationMapper.toResponse(row);
  }

  async findAll(manager: DbManager = this.dataSource.manager) {
    const rows = await manager.query(
      `SELECT id, slug, name, client_type, status, policy, created_at, updated_at FROM apps.applications ORDER BY slug`,
    );
    return rows.map(ApplicationMapper.toResponse);
  }

  async findByIdOrSlug(
    appId: string,
    manager: DbManager = this.dataSource.manager,
  ) {
    const [row] = await manager.query(
      `SELECT id, slug, name, client_type, status, policy, created_at, updated_at FROM apps.applications WHERE id::text = $1 OR slug = $1`,
      [appId],
    );
    return row ? ApplicationMapper.toResponse(row) : null;
  }

  async update(
    id: string,
    input: Record<string, unknown>,
    manager: DbManager = this.dataSource.manager,
  ) {
    const [row] = await manager.query(
      `UPDATE apps.applications SET name = COALESCE($2, name), client_type = COALESCE($3, client_type),
       status = COALESCE($4, status), policy = COALESCE($5, policy), updated_at = now()
       WHERE id = $1 RETURNING id, slug, name, client_type, status, policy, created_at, updated_at`,
      [
        id,
        input.name ?? null,
        input.clientType ?? null,
        input.status ?? null,
        input.policy ?? null,
      ],
    );
    return ApplicationMapper.toResponse(row);
  }
}
