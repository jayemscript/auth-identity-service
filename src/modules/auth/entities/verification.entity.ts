import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'verifications', schema: 'auth' })
export class Verification {
  @PrimaryColumn({ type: 'text' }) id!: string;
  @Column({ type: 'text' }) identifier!: string;
  @Column({ type: 'text' }) value!: string;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt!: Date;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}
