import { betterAuth, type BetterAuthOptions } from 'better-auth';
import type { Auth } from 'better-auth/types';
import { username } from 'better-auth/plugins';
import { Pool } from 'pg';
import * as argon2 from 'argon2';
import { bindBetterAuthToTypeOrmTransaction } from '../common/database';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  options: '-c search_path=auth,identity,public',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
const database = bindBetterAuthToTypeOrmTransaction(pool);

function createOptions(): BetterAuthOptions {
  return {
    secret: process.env.BETTER_AUTH_SECRET ?? '',
    database,
    basePath: '/internal/better-auth',
    emailAndPassword: {
      enabled: true,
      disableSignUp: false,
      autoSignIn: false,
      minPasswordLength: 15,
      maxPasswordLength: 128,
      password: {
        hash: (password: string) =>
          argon2.hash(password, { type: argon2.argon2id }),
        verify: ({ hash, password }: { hash: string; password: string }) =>
          argon2.verify(hash, password),
      },
    },
    user: {
      modelName: 'identity.users',
      fields: {
        emailVerified: 'email_verified',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
      additionalFields: {
        phoneNumber: {
          type: 'string',
          fieldName: 'phone_number',
          required: false,
          input: true,
        },
        emailVerifiedAt: {
          type: 'date',
          fieldName: 'email_verified_at',
          required: false,
          input: false,
          returned: true,
        },
      },
    },
    account: {
      modelName: 'identity.accounts',
      fields: {
        accountId: 'account_id',
        providerId: 'provider_id',
        userId: 'user_id',
        password: 'password_hash',
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        idToken: 'id_token',
        accessTokenExpiresAt: 'access_token_expires_at',
        refreshTokenExpiresAt: 'refresh_token_expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    session: {
      modelName: 'auth.sessions',
      expiresIn: 30 * 24 * 60 * 60,
      updateAge: 0,
      fields: {
        userId: 'user_id',
        expiresAt: 'expires_at',
        ipAddress: 'ip_address',
        userAgent: 'user_agent',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
      additionalFields: {
        applicationId: {
          type: 'string',
          fieldName: 'application_id',
          required: false,
          input: false,
        },
        hardExpiresAt: {
          type: 'date',
          fieldName: 'hard_expires_at',
          required: false,
          input: false,
        },
        refreshGeneration: {
          type: 'number',
          fieldName: 'refresh_generation',
          required: false,
          input: false,
        },
        revokedAt: {
          type: 'date',
          fieldName: 'revoked_at',
          required: false,
          input: false,
        },
        lastRefreshedAt: {
          type: 'date',
          fieldName: 'last_refreshed_at',
          required: false,
          input: false,
        },
      },
    },
    verification: {
      modelName: 'auth.verifications',
      fields: {
        expiresAt: 'expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    plugins: [username({ displayUsername: false })],
    advanced: { database: { generateId: 'uuid' as const } },
  } satisfies BetterAuthOptions;
}

export const auth: Auth<BetterAuthOptions> = betterAuth(createOptions());
