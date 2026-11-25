import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'accounts', schema: 'identity' })
export class Accounts {
  @PrimaryColumn({ type: 'text' }) id!: string;
  @Column({ name: 'account_id', type: 'text' }) accountId!: string;
  @Column({ name: 'provider_id', type: 'text' }) providerId!: string;
  @Column({ name: 'user_id', type: 'text' }) userId!: string;
  @Column({ name: 'password_hash', type: 'text', nullable: true }) password?: string;
  @Column({ name: 'access_token', type: 'text', nullable: true }) accessToken?: string;
  @Column({ name: 'refresh_token', type: 'text', nullable: true }) refreshToken?: string;
  @Column({ name: 'id_token', type: 'text', nullable: true }) idToken?: string;
  @Column({ name: 'access_token_expires_at', type: 'timestamptz', nullable: true }) accessTokenExpiresAt?: Date;
  @Column({ name: 'refresh_token_expires_at', type: 'timestamptz', nullable: true }) refreshTokenExpiresAt?: Date;
  @Column({ type: 'text', nullable: true }) scope?: string;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt!: Date;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' }) updatedAt!: Date;
}
