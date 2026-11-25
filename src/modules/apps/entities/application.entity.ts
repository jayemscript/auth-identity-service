import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'applications', schema: 'apps' })
@Index('uq_apps_slug', ['slug'], { unique: true })
export class Application {
  @PrimaryColumn({ type: 'uuid' }) id!: string;
  @Column({ type: 'citext', unique: true }) slug!: string;
  @Column({ type: 'text' }) name!: string;
  @Column({ name: 'client_type', type: 'text' }) clientType!: string;
  @Column({ type: 'text', default: 'active' }) status!: string;
  @Column({ type: 'jsonb', default: {} }) policy!: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
