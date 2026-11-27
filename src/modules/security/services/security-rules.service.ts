import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';

type QueryManager = Pick<EntityManager, 'query'>;

@Injectable()
export class SecurityRulesService {
  async checkIp(manager: QueryManager, input: {
    applicationId: string;
    ipAddress: string;
    operation: 'login' | 'registration';
  }): Promise<void> {
    try {
      const [decision] = await manager.query(
        `SELECT
          bool_or(effect = 'deny') FILTER (WHERE network >>= $2::inet) AS denied,
          bool_or(effect = 'allow') AS has_allow,
          bool_or(effect = 'allow' AND network >>= $2::inet) AS allowed
         FROM security.ip_rules
         WHERE application_id = $1 AND operation = $3
           AND (expires_at IS NULL OR expires_at > now())`,
        [input.applicationId, input.ipAddress, input.operation],
      );
      if (decision?.denied || (decision?.has_allow && !decision?.allowed)) {
        throw new ForbiddenException({
          code: 'IP_RULE_DENIED',
          message: 'This request is not allowed from the current network.',
        });
      }
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new ServiceUnavailableException(
        'Security rules are temporarily unavailable.',
      );
    }
  }

  async checkEmailDomain(manager: QueryManager, input: {
    applicationId: string;
    email: string;
  }): Promise<void> {
    const domain = input.email.trim().toLowerCase().split('@').at(-1) ?? '';
    try {
      const [decision] = await manager.query(
        `SELECT
          bool_or(effect = 'deny') FILTER (WHERE domain = $2) AS denied,
          bool_or(effect = 'allow') AS has_allow,
          bool_or(effect = 'allow' AND domain = $2) AS allowed
         FROM security.email_domain_rules
         WHERE application_id = $1
           AND (expires_at IS NULL OR expires_at > now())`,
        [input.applicationId, domain],
      );
      if (decision?.denied || (decision?.has_allow && !decision?.allowed)) {
        throw new ForbiddenException({
          code: 'EMAIL_DOMAIN_RULE_DENIED',
          message: 'This email domain is not allowed for registration.',
        });
      }
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new ServiceUnavailableException(
        'Security rules are temporarily unavailable.',
      );
    }
  }
}
