import { AsyncLocalStorage } from 'node:async_hooks';
import { EventEmitter } from 'node:events';
import type { EntityManager } from 'typeorm';
import type { Pool, PoolClient } from 'pg';

type PgConnection = Pick<PoolClient, 'query'>;

const activeConnection = new AsyncLocalStorage<PgConnection>();

/**
 * Better Auth still uses its PostgreSQL pool for ordinary calls. While a
 * TypeORM transaction is active, this runs its adapter queries on that same
 * transaction connection and leaves BEGIN/COMMIT/ROLLBACK to TypeORM.
 */
export function bindBetterAuthToTypeOrmTransaction(pool: Pool): Pool {
  return new Proxy(pool, {
    get(target, property) {
      if (property === 'connect') {
        return (...args: unknown[]) => {
          const connection = activeConnection.getStore();
          if (!connection)
            return Reflect.apply(
              Reflect.get(target, property) as (...args: unknown[]) => unknown,
              target,
              args,
            );

          const client = new EventEmitter() as EventEmitter & {
            query: (...queryArgs: unknown[]) => unknown;
            release: () => void;
          };
          client.query = (...queryArgs: unknown[]) => {
            const [query, valuesOrCallback, callback] = queryArgs;
            const sql =
              typeof query === 'string'
                ? query
                : (query as { text: string }).text;
            const values =
              typeof query === 'string'
                ? valuesOrCallback
                : (query as { values?: unknown[] }).values;
            const done =
              typeof valuesOrCallback === 'function'
                ? valuesOrCallback
                : callback;
            if (/^\s*(BEGIN|COMMIT|ROLLBACK)\b/i.test(sql)) {
              const result = { command: sql.trim().split(/\s+/, 1)[0], rows: [] };
              if (typeof done === 'function') done(null, result);
              return Promise.resolve(result);
            }
            const pending = connection.query(sql, (values ?? []) as unknown[]);
            if (typeof done === 'function') {
              void pending.then(
                (result) => done(null, result),
                (error: unknown) => done(error),
              );
              return client;
            }
            return pending;
          };
          client.release = () => undefined;

          const callback = args.find((arg) => typeof arg === 'function');
          if (typeof callback === 'function')
            callback(null, client, () => undefined);
          return Promise.resolve(client);
        };
      }
      return Reflect.get(target, property, target) as unknown;
    },
  });
}

export async function withBetterAuthTransaction<T>(
  manager: EntityManager,
  callback: () => Promise<T>,
): Promise<T> {
  const queryRunner = manager.queryRunner as
    | (typeof manager.queryRunner & { databaseConnection?: PgConnection })
    | undefined;
  const connection = queryRunner?.databaseConnection;
  return connection
    ? activeConnection.run(connection, callback)
    : callback();
}
