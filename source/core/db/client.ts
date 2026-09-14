import {
  open,
  type DB,
  type SQLBatchTuple,
  type Scalar,
} from '@op-engineering/op-sqlite';
import { drizzle } from 'drizzle-orm/op-sqlite';

import * as schema from './schema';

type DrizzleClient = Parameters<typeof drizzle>[0];

export const connection = open({ name: 'whereismyai.db' });

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

/** Anything Drizzle can compile to SQL without running it. */
export interface Buildable {
  toSQL: () => { sql: string; params: unknown[] };
}

/**
 * Runs every statement in one transaction, so a write that spans tables either
 * lands whole or not at all. Inserting a message and its attachments as two
 * separate awaits used to leave images orphaned if the app died between them.
 */
export async function atomically(...statements: Buildable[]): Promise<void> {
  if (!statements.length) {
    return;
  }
  const batch = statements.map(statement => {
    const { sql, params } = statement.toSQL();
    return [sql, params as Scalar[]] as SQLBatchTuple;
  });
  await connection.executeBatch(batch);
}

export { schema };
