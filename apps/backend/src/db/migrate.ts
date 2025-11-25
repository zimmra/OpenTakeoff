/**
 * Database Migration Runner
 * Applies SQL migrations to the database
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';
import { getDatabase, closeDatabase } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Check if a table exists
 */
function tableExists(sqlite: Database.Database, tableName: string): boolean {
  const result = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(tableName) as { name: string } | undefined;
  return !!result;
}

/**
 * Run all pending migrations
 */
async function runMigrations() {
  const { sqlite } = await getDatabase();

  try {
    console.log('Running database migrations...');

    const drizzlePath = join(__dirname, '../../drizzle');

    // Apply initial schema if stamps table doesn't exist
    if (!tableExists(sqlite, 'stamps')) {
      console.log('Applying initial schema...');
      const initialPath = join(drizzlePath, '0000_initial_schema.sql');
      const initialSql = readFileSync(initialPath, 'utf-8');
      sqlite.exec(initialSql);
      console.log('✓ Initial schema applied');
    }

    // Apply counts migration if counts table doesn't exist
    if (!tableExists(sqlite, 'counts')) {
      console.log('Applying counts migration...');
      const migrationPath = join(drizzlePath, '0001_counts_and_triggers.sql');
      const migrationSql = readFileSync(migrationPath, 'utf-8');
      sqlite.exec(migrationSql);
      console.log('✓ Counts migration applied');
    } else {
      console.log('✓ Counts table already exists, skipping migration');
    }

    // Apply location revisions migration if location_revisions table doesn't exist
    if (!tableExists(sqlite, 'location_revisions')) {
      console.log('Applying location revisions migration...');
      const migrationPath = join(drizzlePath, '0002_location_revisions.sql');
      const migrationSql = readFileSync(migrationPath, 'utf-8');
      sqlite.exec(migrationSql);
      console.log('✓ Location revisions migration applied');
    } else {
      console.log('✓ Location revisions table already exists, skipping migration');
    }

    console.log('✓ All migrations completed successfully');
  } catch (error) {
    console.error('✗ Migration failed:', error);
    throw error;
  } finally {
    closeDatabase();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { runMigrations };
