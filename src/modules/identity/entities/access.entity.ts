import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity({ name: 'user_application_access', schema: 'identity' })
@Index('uq_identity_user_app', ['userId', 'applicationId'], { unique: true })
export class UserApplicationAccess {
  @PrimaryColumn({ type: 'uuid' }) id!: string;
  @Column({ name: 'user_id', type: 'text' }) userId!: string;
  @Column({ name: 'application_id', type: 'uuid' }) applicationId!: string;
  @Column({ type: 'text', default: 'active' }) status!: string;
  @Column({ name: 'grant_source', type: 'text', default: 'operator' })
  grantSource!: string;
  @Column({ name: 'granted_by_user_id', type: 'text', nullable: true })
  grantedByUserId?: string;
  @CreateDateColumn({ name: 'granted_at', type: 'timestamptz' })
  grantedAt!: Date;
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date;
}
