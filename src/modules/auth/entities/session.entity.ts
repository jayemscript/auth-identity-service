import { Column, Entity, Index } from 'typeorm';
@Entity({ name: 'sessions', schema: 'auth' })
@Index('idx_auth_sessions_user_app', ['userId', 'applicationId'])
export class AuthSession {
  @Column({ type: 'text', primary: true }) id!: string;
  @Column({ type: 'text', unique: true }) token!: string;
  @Column({ name: 'user_id', type: 'text' }) userId!: string;
  @Column({ name: 'expires_at', type: 'timestamptz' }) idleExpiresAt!: Date;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
  @Column({ name: 'ip_address', type: 'text', nullable: true })
  ipAddress?: string;
  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;
  @Column({ name: 'application_id', type: 'uuid', nullable: true })
  applicationId?: string;
  @Column({ name: 'hard_expires_at', type: 'timestamptz', nullable: true })
  hardExpiresAt?: Date;
  @Column({ name: 'refresh_generation', type: 'integer', default: 0 })
  refreshGeneration!: number;
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date;
  @Column({ name: 'last_refreshed_at', type: 'timestamptz', nullable: true })
  lastRefreshedAt?: Date;
}
