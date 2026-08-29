import { open, type DB, type Scalar } from '@op-engineering/op-sqlite';
import { drizzle } from 'drizzle-orm/op-sqlite';

import * as schema from './schema';

type DrizzleClient = Parameters<typeof drizzle>[0];

const connection = open({ name: 'whereismyai.db' });

connection.executeSync('PRAGMA journal_mode = WAL');
connection.executeSync('PRAGMA foreign_keys = ON');

function toDrizzleClient(client: DB): DrizzleClient {
  return Object.assign(Object.create(client) as DB, {
    executeAsync: (sql: string, params?: Scalar[]) =>
      client.execute(sql, params),

    executeRawAsync: async (sql: string, params?: Scalar[]) =>
      (await client.executeRaw(sql, params)).rawRows,

    execute: (sql: string, params?: Scalar[]) => {
      const result = client.executeSync(sql, params);
      return { ...result, rows: { _array: result.rows } };
    },
  }) as unknown as DrizzleClient;
}

export const db = drizzle(toDrizzleClient(connection), { schema });
export { schema };
