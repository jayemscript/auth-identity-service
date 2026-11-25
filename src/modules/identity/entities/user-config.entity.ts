import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'user_configs', schema: 'identity' })
export class UserConfig {
  @PrimaryColumn({ type: 'uuid' }) id!: string;
  @Column({ name: 'user_id', type: 'text', unique: true }) userId!: string;
  @Column({ type: 'text', default: 'active' }) status!: string;
  @Column({ name: 'is_banned', type: 'boolean', default: false })
  isBanned!: boolean;
  @Column({ name: 'ban_expires_at', type: 'timestamptz', nullable: true })
  banExpiresAt?: Date;
  @Column({ name: 'is_superadmin', type: 'boolean', default: false })
  isSuperAdmin!: boolean;
  @Column({ name: 'can_create_users', type: 'boolean', default: false })
  canCreateUsers!: boolean;
  @Column({ name: 'session_limit_override', type: 'integer', nullable: true })
  sessionLimitOverride?: number;
  @Column({
    name: 'creation_source',
    type: 'text',
    default: 'public_registration',
  })
  creationSource!: string;
  @Column({ name: 'created_by_user_id', type: 'text', nullable: true })
  createdByUserId?: string;
  @Column({ name: 'created_by_application_id', type: 'uuid', nullable: true })
  createdByApplicationId?: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
