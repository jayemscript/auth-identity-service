import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ApplicationMapper } from '../mappers/application.mapper';

type DbManager = Pick<EntityManager, 'query'>;

@Injectable()
export class ApplicationRepository {
  constructor(private readonly dataSource: DataSource) {}

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
}
