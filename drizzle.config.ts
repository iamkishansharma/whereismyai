import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './source/core/db/schema.ts',
  out: './source/core/db/migrations',
  dialect: 'sqlite',
  driver: 'expo',
});
