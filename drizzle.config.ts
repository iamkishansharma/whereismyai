import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './source/db/schema.ts',
  out: './source/db/migrations',
  dialect: 'sqlite',
  driver: 'expo',
});
