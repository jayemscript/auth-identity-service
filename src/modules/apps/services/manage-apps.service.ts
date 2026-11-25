import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApplicationRepository } from '../repositories/application.repository';

@Injectable()
export class ManageAppsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly applications: ApplicationRepository,
  ) {}

  async execute(input: {
    action: 'create' | 'list' | 'get' | 'update';
    appId?: string;
    body?: Record<string, unknown>;
  }) {
    if (input.action === 'create') {
      const body = input.body ?? {};
      try {
        return await this.applications.create(body);
      } catch (error) {
        if ((error as { code?: string }).code === '23505')
          throw new ConflictException(
            'An app with this slug already exists. Choose a different slug.',
          );
        throw error;
      }
    }
    if (input.action === 'list') return this.applications.findAll();
    const existing = await this.applications.findByIdOrSlug(input.appId ?? '');
    if (!existing) throw new NotFoundException('We could not find this app.');
    if (input.action === 'get') return existing;
    const body = input.body ?? {};
    const [admin] = await this.dataSource.query(
      `SELECT value->>'slug' AS slug FROM system.settings WHERE key = 'administration.app_slug' AND application_id IS NULL`,
    );
    if (existing.slug === admin?.slug && body.status === 'disabled')
      throw new ForbiddenException(
        'The admin app cannot be disabled because it is required to manage the service.',
      );
    const updated = await this.dataSource.transaction(async (tx) => {
      const updated = await this.applications.update(existing.id, body, tx);
      if (body.status === 'disabled')
        await tx.query(
          `UPDATE auth.sessions SET revoked_at = now() WHERE application_id = $1 AND revoked_at IS NULL`,
          [existing.id],
        );
      return updated;
    });
    return updated;
  }
}
