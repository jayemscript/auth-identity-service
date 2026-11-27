import { createHmac } from 'node:crypto';

export function digestLoginSubject(value: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`login-subject\0${value.trim().toLowerCase()}`)
    .digest('hex');
}

export function digestDeviceId(input: {
  applicationId: string;
  userId: string;
  deviceId: string;
  secret: string;
}): string {
  return createHmac('sha256', input.secret)
    .update(`user-device\0${input.applicationId}\0${input.userId}\0${input.deviceId}`)
    .digest('hex');
}

export function isValidDeviceId(value: string): boolean {
  return /^[A-Za-z0-9_-]{22,128}$/.test(value);
}
