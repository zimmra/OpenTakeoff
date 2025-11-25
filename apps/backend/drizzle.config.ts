/**
 * Drizzle Kit Configuration
 * Configuration for database migrations and introspection
 */

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
