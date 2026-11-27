import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import { DataSource } from 'typeorm';
import { ChallengeType } from '../challenge.types';

@Injectable()
export class ChallengeLifecycleService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}
  private digest(proof: string) {
    return createHmac(
      'sha256',
      this.config.getOrThrow<string>('CHALLENGE_PROOF_SECRET'),
    )
      .update(proof)
      .digest('hex');
  }
  async create(input: {
    applicationId: string;
    type: ChallengeType;
    subjectRef: string;
  }) {
    const [definition] = await this.dataSource.query(
      'SELECT * FROM challenges.catalog WHERE type=$1',
      [input.type],
    );
    if (!definition) throw new NotFoundException('Challenge type not found.');
    const proof =
      input.type === 'security-alert'
        ? null
        : input.type === 'email-verification' ||
            input.type === 'otp-verification' ||
            input.type === 'mfa'
          ? randomInt(0, 1000000).toString().padStart(6, '0')
          : randomBytes(32).toString('base64url');
    const [row] = await this.dataSource.query(
      `INSERT INTO challenges.instances(application_id,challenge_type,subject_ref,proof_digest,status,expires_at,max_attempts)
      VALUES($1,$2,$3,$4,'pending',CASE WHEN $5::int IS NULL THEN NULL ELSE now()+($5 || ' seconds')::interval END,$6) RETURNING id,expires_at`,
      [
        input.applicationId,
        input.type,
        input.subjectRef,
        proof ? this.digest(proof) : null,
        definition.default_expiry_seconds,
        definition.max_attempts,
      ],
    );
    return { id: row.id, expiresAt: row.expires_at, proof };
  }
  async verify(input: {
    applicationId: string;
    id: string;
    type: ChallengeType;
    subjectRef: string;
    proof: string;
  }) {
    return this.dataSource.transaction(async (manager) => {
      const [row] = await manager.query(
        'SELECT * FROM challenges.instances WHERE id=$1 AND application_id=$2 AND challenge_type=$3 AND subject_ref=$4 FOR UPDATE',
        [input.id, input.applicationId, input.type, input.subjectRef],
      );
      if (!row) throw new NotFoundException('Challenge not found.');
      if (row.status !== 'pending')
        return { verified: false, status: row.status };
      if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
        await manager.query(
          "UPDATE challenges.instances SET status='expired',updated_at=now() WHERE id=$1",
          [input.id],
        );
        return { verified: false, status: 'expired' };
      }
      const supplied = Buffer.from(this.digest(input.proof), 'hex'),
        expected = Buffer.from(row.proof_digest ?? '', 'hex');
      const valid =
        supplied.length === expected.length &&
        timingSafeEqual(supplied, expected);
      if (!valid) {
        const attempts = row.failed_attempts + 1,
          exhausted = attempts >= row.max_attempts;
        await manager.query(
          "UPDATE challenges.instances SET failed_attempts=$2,status=CASE WHEN $3 THEN 'exhausted' ELSE status END,updated_at=now() WHERE id=$1",
          [input.id, attempts, exhausted],
        );
        return { verified: false, status: exhausted ? 'exhausted' : 'pending' };
      }
      await manager.query(
        "UPDATE challenges.instances SET status='verified',updated_at=now() WHERE id=$1",
        [input.id],
      );
      return { verified: true, status: 'verified' };
    });
  }
  async consume(input: {
    applicationId: string;
    id: string;
    type: ChallengeType;
    subjectRef: string;
    proof: string;
  }) {
    return this.dataSource.transaction(async (manager) => {
      const [row] = await manager.query(
        'SELECT * FROM challenges.instances WHERE id=$1 AND application_id=$2 AND challenge_type=$3 AND subject_ref=$4 FOR UPDATE',
        [input.id, input.applicationId, input.type, input.subjectRef],
      );
      if (!row) throw new NotFoundException('Challenge not found.');
      if (row.status !== 'verified')
        throw new BadRequestException('Challenge is not verified.');
      const supplied = Buffer.from(this.digest(input.proof), 'hex'),
        expected = Buffer.from(row.proof_digest, 'hex');
      if (
        supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)
      )
        throw new BadRequestException('Challenge proof is invalid.');
      if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
        await manager.query(
          "UPDATE challenges.instances SET status='expired',updated_at=now() WHERE id=$1",
          [input.id],
        );
        return { id: input.id, status: 'expired' };
      }
      await manager.query(
        "UPDATE challenges.instances SET status='consumed',updated_at=now() WHERE id=$1",
        [input.id],
      );
      return { id: input.id, status: 'consumed' };
    });
  }
  async expire() {
    return this.dataSource.query(
      "UPDATE challenges.instances SET status='expired',updated_at=now() WHERE status IN ('pending','verified') AND expires_at<=now() RETURNING id",
    );
  }
  async revoke(input: { applicationId: string; id: string }) {
    const result = await this.dataSource.query(
      "UPDATE challenges.instances SET status='revoked',updated_at=now() WHERE id=$1 AND application_id=$2 AND status IN ('pending','verified') RETURNING id",
      [input.id, input.applicationId],
    );
    if (!result.length)
      throw new NotFoundException('Active challenge not found.');
    return { id: input.id, status: 'revoked' };
  }
}
