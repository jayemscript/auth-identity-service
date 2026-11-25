import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'users', schema: 'identity' })
export class User {
  @PrimaryColumn({ type: 'text' }) id!: string;
  @Column({ type: 'text' }) name!: string;
  @Column({ type: 'citext', unique: true }) email!: string;
  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified!: boolean;
  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt?: Date;
  @Column({ type: 'text', nullable: true }) image?: string;
  @Column({ type: 'citext', unique: true, nullable: true }) username?: string;
  @Column({ name: 'phone_number', type: 'text', nullable: true }) phoneNumber?: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
