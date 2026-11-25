import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserAccessRepository } from '../repositories/user-access.repository';

@Injectable()
export class ManageAccessService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly userAccess: UserAccessRepository,
  ) {}

  async execute(input: {
    action: 'grant' | 'revoke' | 'config';
    appId?: string;
    userId: string;
    actorId?: string;
    body?: { canCreateUsers?: boolean; sessionLimitOverride?: number | null };
  }) {
    if (input.action === 'config') {
      const body = input.body ?? {};
      if (
        body.sessionLimitOverride !== undefined &&
        body.sessionLimitOverride !== null &&
        body.sessionLimitOverride < 1
      )
        throw new ConflictException('Session limit must be positive');
      const rows = await this.dataSource.query(
        `UPDATE identity.user_configs SET can_create_users = COALESCE($2, can_create_users),
          session_limit_override = CASE WHEN $3::boolean THEN $4::integer ELSE session_limit_override END
         WHERE user_id = $1 RETURNING user_id, can_create_users, session_limit_override`,
        [
          input.userId,
          body.canCreateUsers ?? null,
          body.sessionLimitOverride !== undefined,
          body.sessionLimitOverride ?? null,
        ],
      );
      if (!rows.length) throw new NotFoundException('User config not found');
      return rows[0];
    }
    const [app] = await this.dataSource.query(
      `SELECT id, slug FROM apps.applications WHERE id::text = $1 OR slug = $1`,
      [input.appId],
    );
    if (!app) throw new NotFoundException('App not found');
    if (input.action === 'grant') {
      return this.userAccess.grant({
        userId: input.userId,
        appId: app.id,
        actorId: input.actorId,
      });
    }
    return this.dataSource.transaction(async (tx) => {
      const [admin] = await tx.query(
        `SELECT value->>'slug' AS slug FROM system.settings WHERE key = 'administration.app_slug' AND application_id IS NULL`,
      );
      const [superAdmin] = await tx.query(
        `SELECT is_superadmin FROM identity.user_configs WHERE user_id = $1`,
        [input.userId],
      );
      if (app.slug === admin?.slug && superAdmin?.is_superadmin)
        throw new ForbiddenException(
          'Cannot revoke the SuperAdmin admin-app grant',
        );
      const grant = await tx.query(
        `UPDATE identity.user_application_access SET status = 'revoked', revoked_at = now() WHERE user_id = $1 AND application_id = $2 AND status = 'active' RETURNING id`,
        [input.userId, app.id],
      );
      if (grant.length)
        await tx.query(
          `UPDATE auth.sessions SET revoked_at = now() WHERE user_id = $1 AND application_id = $2 AND revoked_at IS NULL`,
          [input.userId, app.id],
        );
      return { revoked: grant.length > 0 };
    });
  }
}
