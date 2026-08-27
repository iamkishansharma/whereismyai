import { useMigrations } from 'drizzle-orm/op-sqlite/migrator';

import { db } from './client';
import migrations from './migrations/migrations';

export function useDatabaseMigrations() {
  return useMigrations(db, migrations);
}
