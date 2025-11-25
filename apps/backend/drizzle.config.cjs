/**
 * Drizzle Kit Configuration (CommonJS wrapper)
 * Workaround for drizzle-kit ESM loading issues
 */

/* eslint-disable */
const { defineConfig } = require('drizzle-kit');

module.exports = defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
