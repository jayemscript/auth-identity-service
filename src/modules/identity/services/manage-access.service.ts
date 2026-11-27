import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserAccessRepository } from '../repositories/user-access.repository';
import { UserConfigResponseDto } from '../dtos';
import { AuditLogService } from '../../security';
import { PublishDomainEventService } from '../../events/services';

@Injectable()
export class ManageAccessService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly userAccess: UserAccessRepository,
    private readonly audit: AuditLogService,
    private readonly events: PublishDomainEventService,
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
        throw new ConflictException('The session limit must be at least one.');
      const rows = await this.dataSource.transaction(async (tx) => {
        const changed = await tx.query(
        `WITH changed AS (UPDATE identity.user_configs SET can_create_users = COALESCE($2, can_create_users),
          session_limit_override = CASE WHEN $3::boolean THEN $4::integer ELSE session_limit_override END
         WHERE user_id = $1 RETURNING user_id, can_create_users, session_limit_override)
         SELECT * FROM changed`,
        [
          input.userId,
          body.canCreateUsers ?? null,
          body.sessionLimitOverride !== undefined,
          body.sessionLimitOverride ?? null,
        ],
        );
        if (changed.length) await this.audit.execute(tx, { actorUserId: input.actorId, targetUserId: input.userId, action: 'user.config.updated', changes: { canCreateUsers: changed[0].can_create_users, sessionLimitOverride: changed[0].session_limit_override } });
        return changed;
      });
      if (!rows.length)
        throw new NotFoundException(
          'We could not find settings for this user.',
        );
      return Object.assign(new UserConfigResponseDto(), {
        userId: rows[0].user_id,
        canCreateUsers: rows[0].can_create_users,
        sessionLimitOverride: rows[0].session_limit_override,
      });
    }
    const [app] = await this.dataSource.query(
      `SELECT id, slug FROM apps.applications WHERE id::text = $1 OR slug = $1`,
      [input.appId],
    );
    if (!app) throw new NotFoundException('We could not find this app.');
    if (input.action === 'grant') {
      return this.userAccess.grant({
        userId: input.userId,
        appId: app.id,
        actorId: input.actorId,
      });
    }
    return this.dataSource.transaction(async (tx) => {
      const [admin] = await tx.query(
        `SELECT value #>> '{}' AS slug FROM system.settings WHERE key = 'administration.app_slug' AND application_id IS NULL`,
      );
      const [superAdmin] = await tx.query(
        `SELECT is_superadmin FROM identity.user_configs WHERE user_id = $1`,
        [input.userId],
      );
      if (app.slug === admin?.slug && superAdmin?.is_superadmin)
        throw new ForbiddenException(
          'The SuperAdmin account must keep access to the admin app.',
        );
      const grant = await tx.query(
        `WITH revoked AS (UPDATE identity.user_application_access SET status = 'revoked', revoked_at = now() WHERE user_id = $1 AND application_id = $2 AND status = 'active' RETURNING id)
         SELECT id FROM revoked`,
        [input.userId, app.id],
      );
      if (grant.length) {
        const sessions = await tx.query(
          `WITH revoked AS (UPDATE auth.sessions SET revoked_at = now(), updated_at = now() WHERE user_id = $1 AND application_id = $2 AND revoked_at IS NULL RETURNING id)
           SELECT id FROM revoked`,
          [input.userId, app.id],
        );
        await this.audit.execute(tx, { applicationId: app.id, actorUserId: input.actorId, targetUserId: input.userId, action: 'user.app_access.revoked' });
        await this.events.execute(tx, { applicationId: app.id, eventType: 'user.app_access.revoked', aggregateType: 'user', aggregateId: input.userId, payload: { userId: input.userId } });
        for (const session of sessions) {
          await this.audit.execute(tx, { applicationId: app.id, actorUserId: input.actorId, targetUserId: input.userId, action: 'session.revoked', changes: { sessionId: session.id, reason: 'app_access_revoked' } });
          await this.events.execute(tx, { applicationId: app.id, eventType: 'session.revoked', aggregateType: 'session', aggregateId: session.id, payload: { userId: input.userId, sessionId: session.id, reason: 'app_access_revoked' } });
        }
      }
      return { revoked: grant.length > 0 };
    });
  }
}
