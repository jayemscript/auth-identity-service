export interface UserAccessRow {
  id: string;
  user_id: string;
  application_id: string;
  status: string;
  grant_source: string;
  granted_by_user_id: string | null;
  granted_at: Date;
  revoked_at: Date | null;
}

export class AccessMapper {
  static toResponse(row: UserAccessRow): UserApplicationAccessResponseDto {
    return Object.assign(new UserApplicationAccessResponseDto(), {
      id: row.id,
      userId: row.user_id,
      appId: row.application_id,
      status: row.status,
      grantSource: row.grant_source,
      grantedByUserId: row.granted_by_user_id,
      grantedAt: row.granted_at,
      revokedAt: row.revoked_at,
    });
  }
}
import { UserApplicationAccessResponseDto } from '../dtos';

