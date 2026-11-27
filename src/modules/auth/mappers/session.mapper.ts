import { SessionResponseDto } from '../dtos';

export interface SessionResponseRow {
  id: string;
  status: 'active' | 'revoked' | 'expired';
  created_at: Date;
  last_refresh_at: Date | null;
  idle_expires_at: Date;
  hard_expires_at: Date;
}

export class SessionMapper {
  static toResponse(row: SessionResponseRow): SessionResponseDto {
    return Object.assign(new SessionResponseDto(), {
      id: row.id,
      status: row.status,
      createdAt: row.created_at,
      lastRefreshAt: row.last_refresh_at,
      idleExpiresAt: row.idle_expires_at,
      hardExpiresAt: row.hard_expires_at,
    });
  }
}
