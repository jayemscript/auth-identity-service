import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ChallengeLifecycleService } from './challenge-lifecycle.service';

describe('ChallengeLifecycleService', () => {
  const manager = { query: jest.fn() };
  const source = { query: jest.fn(), transaction: jest.fn((callback) => callback(manager)) };
  const config = { getOrThrow: jest.fn(() => 'test-challenge-secret') };
  let service: ChallengeLifecycleService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ChallengeLifecycleService(source as unknown as DataSource, config as unknown as ConfigService);
  });

  it('creates six-digit email verification proofs and snapshots catalog defaults', async () => {
    source.query.mockResolvedValueOnce([{ default_expiry_seconds: 900, max_attempts: 5 }]).mockResolvedValueOnce([{ id: 'id-1', expires_at: new Date() }]);
    const result = await service.create({ applicationId: 'app-1', type: 'email-verification', subjectRef: 'subject-1' });
    expect(result.proof).toMatch(/^\d{6}$/);
    expect(source.query.mock.calls[1][1][0]).toBe('app-1');
    expect(source.query.mock.calls[1][1][5]).toBe(5);
  });

  it('does not create an instance for an unknown type', async () => {
    source.query.mockResolvedValueOnce([]);
    await expect(service.create({ applicationId: 'app-1', type: 'mfa', subjectRef: 'subject-1' })).rejects.toThrow('Challenge type not found.');
    expect(source.query).toHaveBeenCalledTimes(1);
  });

  it('scopes verification to app, type, and subject and rejects expired proofs', async () => {
    manager.query.mockResolvedValueOnce([{ status: 'pending', expires_at: new Date(0), failed_attempts: 0, max_attempts: 5 }]).mockResolvedValueOnce([]);
    const result = await service.verify({ applicationId: 'app-1', id: 'id-1', type: 'password-reset', subjectRef: 'subject-1', proof: 'secret' });
    expect(manager.query.mock.calls[0][1]).toEqual(['id-1', 'app-1', 'password-reset', 'subject-1']);
    expect(result).toEqual({ verified: false, status: 'expired' });
  });

  it('allows only one verified consumption', async () => {
    manager.query.mockResolvedValueOnce([{ status: 'verified', proof_digest: require('node:crypto').createHmac('sha256', 'test-challenge-secret').update('secret').digest('hex'), expires_at: null }]).mockResolvedValueOnce([]);
    const result = await service.consume({ applicationId: 'app-1', id: 'id-1', type: 'password-reset', subjectRef: 'subject-1', proof: 'secret' });
    expect(result.status).toBe('consumed');
    expect(manager.query.mock.calls[1][0]).toContain("status='consumed'");
  });

  it('rejects exhausted proof attempts and updates the terminal state', async () => {
    manager.query.mockResolvedValueOnce([{ status: 'pending', proof_digest: 'a'.repeat(64), expires_at: null, failed_attempts: 4, max_attempts: 5 }]).mockResolvedValueOnce([]);
    const result = await service.verify({ applicationId: 'app-1', id: 'id-1', type: 'password-reset', subjectRef: 'subject-1', proof: 'wrong' });
    expect(result).toEqual({ verified: false, status: 'exhausted' });
    expect(manager.query.mock.calls[1][1][2]).toBe(true);
  });
});
