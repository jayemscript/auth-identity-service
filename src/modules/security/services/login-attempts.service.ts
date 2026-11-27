import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

type QueryManager = Pick<EntityManager, 'query'>;

@Injectable()
export class LoginAttemptsService {
  async isLocked(manager: QueryManager, applicationId: string, identifierHash: string): Promise<boolean> {
    const [row] = await manager.query(
      `SELECT 1 FROM security.account_lockouts
       WHERE application_id = $1 AND subject_hash = decode($2, 'hex') AND locked_until > now()
       LIMIT 1`,
      [applicationId, identifierHash],
    );
    return Boolean(row);
  }

  async recordFailure(manager: QueryManager, input: {
    applicationId: string;
    identifierHash: string;
    userId?: string;
    ipAddress?: string;
    threshold: number;
    durationMinutes: number;
  }): Promise<boolean> {
    await manager.query(
      `INSERT INTO security.login_attempts(application_id, subject_hash, user_id, ip_address, succeeded)
       VALUES ($1, decode($2, 'hex'), $4, $3, false)`,
      [input.applicationId, input.identifierHash, input.ipAddress ?? null, input.userId ?? null],
    );
    if (input.threshold <= 0) return false;
    const [count] = await manager.query(
      `SELECT count(*)::int AS count FROM security.login_attempts
       WHERE application_id = $1 AND subject_hash = decode($2, 'hex')
         AND succeeded = false AND attempted_at >= now() - interval '15 minutes'
         AND attempted_at > COALESCE((SELECT max(success.attempted_at) FROM security.login_attempts success
           WHERE success.application_id = $1 AND success.subject_hash = decode($2, 'hex') AND success.succeeded), '-infinity')`,
      [input.applicationId, input.identifierHash],
    );
    if (Number(count?.count ?? 0) < input.threshold) return false;
    await manager.query(
      `INSERT INTO security.account_lockouts(application_id, subject_hash, user_id, failed_attempts, locked_until)
       VALUES ($1, decode($2, 'hex'), $3, $4, now() + ($5::int * interval '1 minute'))`,
      [input.applicationId, input.identifierHash, input.userId ?? null, Number(count?.count ?? 0), input.durationMinutes],
    );
    return true;
  }

  async recordSuccess(manager: QueryManager, input: {
    applicationId: string;
    identifierHash: string;
    userId: string;
  }): Promise<void> {
    await manager.query(
      `INSERT INTO security.login_attempts(application_id, subject_hash, user_id, succeeded)
       VALUES ($1, decode($2, 'hex'), $3, true)`,
      [input.applicationId, input.identifierHash, input.userId],
    );
  }
}
