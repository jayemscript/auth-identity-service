import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { auth } from '../../../auth/better-auth';
import { withBetterAuthTransaction } from '../../../common/database';
import { RegistrationResponseDto } from '../dtos';

export interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
  username?: string;
  phone?: string;
  verifiedEmail?: string;
  source: 'public_registration' | 'operator';
  actorId?: string;
  appSlug: string;
}

function isDuplicateIdentityError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
    body?: { code?: unknown };
    driverError?: { code?: unknown };
    message?: unknown;
  };
  return (
    candidate.code === '23505' ||
    candidate.driverError?.code === '23505' ||
    candidate.status === 409 ||
    candidate.statusCode === 409 ||
    candidate.body?.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' ||
    candidate.body?.code === 'USERNAME_IS_ALREADY_TAKEN' ||
    (typeof candidate.message === 'string' &&
      /email.*already exists|username.*already (exists|taken)/i.test(
        candidate.message,
      ))
  );
}

@Injectable()
export class RegisterUserService {
  constructor(private readonly dataSource: DataSource) {}

  async execute(input: RegisterUserInput): Promise<RegistrationResponseDto> {
    const manager = this.dataSource.manager;
    const app = await manager.query(
      `SELECT id, status, policy FROM apps.applications WHERE slug = $1`,
      [input.appSlug.trim().toLowerCase()],
    );
    if (!app.length || app[0].status !== 'active')
      throw new ForbiddenException('Unknown or inactive app');
    const appPolicy = app[0].policy ?? {};
    const projectAndAppSettings = await manager.query(
      `SELECT key, value FROM system.settings WHERE application_id IS NULL OR application_id = $1 ORDER BY application_id NULLS FIRST`,
      [app[0].id],
    );
    const resolvedSettings = new Map(
      projectAndAppSettings.map((row: { key: string; value: unknown }) => [
        row.key,
        row.value,
      ]),
    );
    const mode =
      appPolicy.registrationMode ??
      resolvedSettings.get('registration.mode') ??
      'public';
    if (
      mode === 'disabled' ||
      (input.source === 'public_registration' && mode !== 'public')
    ) {
      throw new ForbiddenException('Registration is disabled');
    }
    if (input.source === 'operator') {
      if (!input.actorId)
        throw new ForbiddenException('An authorized actor is required');
      const [actor] = await manager.query(
        `SELECT c.can_create_users, s.application_id FROM identity.user_configs c
         JOIN auth.sessions s ON s.user_id = c.user_id
         WHERE c.user_id = $1 AND s.application_id = $2 AND s.expires_at > now()
         AND s.revoked_at IS NULL LIMIT 1`,
        [input.actorId, app[0].id],
      );
      if (!actor?.can_create_users)
        throw new ForbiddenException('Actor cannot create users');
    }
    const verificationRequired = Boolean(
      appPolicy.emailVerificationRequired ??
      resolvedSettings.get('email_verification.required') ??
      false,
    );
    const verified =
      verificationRequired &&
      input.verifiedEmail?.trim().toLowerCase() ===
        input.email.trim().toLowerCase();
    if (verificationRequired && !verified)
      throw new ForbiddenException('Verified email assertion is required');

    try {
      const signUp = auth.api.signUpEmail as unknown as (args: {
        body: Record<string, unknown>;
      }) => Promise<{ user: { id: string } }>;
      return await this.dataSource.transaction(async (tx) => {
        const created = await withBetterAuthTransaction(tx, () =>
          signUp({
            body: {
              name: input.name.trim(),
              email: input.email.trim().toLowerCase(),
              password: input.password,
              ...(input.phone ? { phoneNumber: input.phone.trim() } : {}),
              ...(input.username
                ? { username: input.username.trim().toLowerCase() }
                : {}),
            },
          }),
        );
        if (verified)
          await tx.query(
            `UPDATE identity.users SET email_verified = true, email_verified_at = now(), updated_at = now() WHERE id = $1`,
            [created.user.id],
          );
        await tx.query(
          `INSERT INTO identity.user_configs (id, user_id, creation_source, created_by_user_id, created_by_application_id)
           VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
          [
            created.user.id,
            input.source,
            input.actorId ?? null,
            app[0].id,
          ],
        );
        await tx.query(
          `INSERT INTO identity.user_application_access (id, user_id, application_id, status, grant_source, granted_by_user_id)
           VALUES (gen_random_uuid(), $1, $2, 'active', $3, $4)`,
          [
            created.user.id,
            app[0].id,
            input.source === 'operator' ? 'operator' : 'registration',
            input.actorId ?? null,
          ],
        );
        return Object.assign(new RegistrationResponseDto(), {
          userId: created.user.id,
        });
      });
    } catch (error) {
      if (isDuplicateIdentityError(error))
        throw new ConflictException('Email or username already exists');
      throw new UnprocessableEntityException(
        'Unable to complete registration',
        { cause: error },
      );
    }
  }
}
