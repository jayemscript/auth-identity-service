import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { digestDeviceId, isValidDeviceId } from './security-digest';

type QueryManager = Pick<EntityManager, 'query'>;

@Injectable()
export class UserDevicesService {
  async recognize(manager: QueryManager, input: {
    applicationId: string;
    userId: string;
    deviceId: string;
  }): Promise<{ deviceId: string; isNew: boolean }> {
    if (!isValidDeviceId(input.deviceId)) throw new RangeError('Invalid device identifier.');
    const secret = process.env.DEVICE_ID_HMAC_SECRET;
    if (!secret) throw new Error('DEVICE_ID_HMAC_SECRET is required for device recognition.');
    const deviceHash = digestDeviceId({ ...input, secret });
    const [created] = await manager.query(
      `INSERT INTO security.user_devices(application_id, user_id, device_hash, first_seen_at, last_seen_at)
       VALUES ($1, $2, decode($3, 'hex'), now(), now())
       ON CONFLICT (application_id, user_id, device_hash) DO NOTHING
       RETURNING id`,
      [input.applicationId, input.userId, deviceHash],
    );
    if (created) return { deviceId: created.id, isNew: true };
    const [existing] = await manager.query(
      `WITH updated AS (
        UPDATE security.user_devices SET last_seen_at = now()
        WHERE application_id = $1 AND user_id = $2 AND device_hash = decode($3, 'hex')
        RETURNING id
      ) SELECT id FROM updated`,
      [input.applicationId, input.userId, deviceHash],
    );
    return { deviceId: existing.id, isNew: false };
  }
}
