import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base-entity';

/**
 * holds all unique configuration details per user
 * One To One
 */
@Entity('users_config')
export class UserConfig extends BaseEntity {
  @Column({
    name: 'is_banned',
    type: 'boolean',
    nullable: true,
  })
  isBanned!: boolean;

  @Column({
    name: 'ban_reason',
    type: 'text',
  })
  banReason!: string;

  @Column({ name: 'banned_expires', type: 'timestamp', nullable: true })
  banExpires?: Date;

  // only 1 account
  @Column({
    name: 'is_superadmin',
    type: 'boolean',
  })
  isSuperAdmin!: boolean;

  @Column({
    name: 'multi_factor_enabled',
    type: 'boolean',
    nullable: true,
  })
  multiFactorEnabled?: boolean;

  @Column({
    name: 'must_change_password',
    type: 'boolean',
    nullable: true,
  })
  mustChangePassword?: boolean;

  @Column({ name: 'password_changed_at', type: 'timestamp', nullable: true })
  passwordChangedAt?: Date;

  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt?: Date;

  @Column({ name: 'last_login_ip', type: 'inet', nullable: true })
  lastLoginIP?: Date;

  @Column({ name: 'anonymized_at', type: 'timestamp', nullable: true })
  anonymizedAt?: Date;
}
