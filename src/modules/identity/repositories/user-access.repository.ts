import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AccessMapper } from '../mappers/access.mapper';

@Injectable()
export class UserAccessRepository {
  constructor(private readonly dataSource: DataSource) {}

  async grant(input: { userId: string; appId: string; actorId?: string }) {
    const [row] = await this.dataSource.query(
      `INSERT INTO identity.user_application_access (id, user_id, application_id, status, grant_source, granted_by_user_id, granted_at, revoked_at)
       VALUES (gen_random_uuid(), $1, $2, 'active', 'operator', $3, now(), NULL)
       ON CONFLICT (user_id, application_id) DO UPDATE SET status = 'active', grant_source = 'operator', granted_by_user_id = $3, granted_at = now(), revoked_at = NULL
       RETURNING id, user_id, application_id, status, grant_source, granted_by_user_id, granted_at, revoked_at`,
      [input.userId, input.appId, input.actorId ?? null],
    );
    return AccessMapper.toResponse(row);
  }
}
