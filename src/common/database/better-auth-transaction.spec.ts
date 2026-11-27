import type { Pool, PoolClient } from 'pg';
import type { EntityManager } from 'typeorm';
import {
  bindBetterAuthToTypeOrmTransaction,
  withBetterAuthTransaction,
} from './better-auth-transaction';

describe('Better Auth TypeORM transaction bridge', () => {
  it('routes adapter queries through the TypeORM connection and delegates transaction boundaries', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ id: 'user-1' }] });
    const pool = {
      connect: jest.fn(),
    } as unknown as Pool;
    const database = bindBetterAuthToTypeOrmTransaction(pool);
    const manager = {
      queryRunner: { databaseConnection: { query } },
    } as unknown as EntityManager;

    await withBetterAuthTransaction(manager, async () => {
      const client = await database.connect();
      await client.query('BEGIN');
      const result = await client.query('SELECT id FROM identity.users');
      await client.query('COMMIT');
      expect(result.rows).toEqual([{ id: 'user-1' }]);
    });

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith('SELECT id FROM identity.users', []);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('uses the normal pool connection outside a TypeORM transaction', async () => {
    const client = { release: jest.fn() } as unknown as PoolClient;
    const connect = jest.fn().mockResolvedValue(client);
    const pool = { connect } as unknown as Pool;
    const database = bindBetterAuthToTypeOrmTransaction(pool);
    await expect(database.connect()).resolves.toBe(client);
    expect(connect).toHaveBeenCalledTimes(1);
  });
});
