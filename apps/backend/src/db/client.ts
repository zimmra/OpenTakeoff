/**
 * Database Client
 * SQLite connection with Drizzle ORM
 */

import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { config, isDev } from '../config.js';
import * as schema from './schema.js';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Create SQLite database directory if it doesn't exist
 */
async function ensureDatabaseDirectory() {
  const dir = dirname(config.DATABASE_PATH);
  try {
    await mkdir(dir, { recursive: true });
  } catch (error) {
    // Ignore if directory already exists
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Check if database is in an inconsistent state where tables exist
 * but migrations aren't tracked. This happens when db:push was used
 * instead of migrations, or when the migrations table was reset.
 */
function checkMigrationConsistency(sqlite: Database.Database): {
  isInconsistent: boolean;
  hasProjectsTable: boolean;
  hasMigrationsTracked: boolean;
} {
  // Check if projects table exists (our first migration creates this)
  const projectsTableExists = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='projects'`)
    .get() as { name: string } | undefined;

  // Check if migrations tracking table has any entries
  const migrationsTableExists = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'`)
    .get() as { name: string } | undefined;

  let migrationsCount = 0;
  if (migrationsTableExists) {
    const result = sqlite.prepare(`SELECT COUNT(*) as count FROM "__drizzle_migrations"`).get() as {
      count: number;
    };
    migrationsCount = result.count;
  }

  const hasProjectsTable = !!projectsTableExists;
  const hasMigrationsTracked = migrationsCount > 0;

  // Inconsistent state: tables exist but migrations aren't tracked
  const isInconsistent = hasProjectsTable && !hasMigrationsTracked;

  return { isInconsistent, hasProjectsTable, hasMigrationsTracked };
}

/**
 * Reset database by deleting all files. Used in development to recover
 * from inconsistent migration state.
 */
async function resetDatabase(sqlite: Database.Database): Promise<void> {
  console.log('🔄 Resetting database due to inconsistent migration state...');

  // Close the current connection
  sqlite.close();

  // Delete database files
  const dbPath = config.DATABASE_PATH;
  await Promise.all([
    rm(dbPath, { force: true }),
    rm(`${dbPath}-shm`, { force: true }),
    rm(`${dbPath}-wal`, { force: true }),
  ]);

  console.log('✅ Database reset complete. Migrations will run fresh.');
}

/**
 * Create better-sqlite3 connection
 */
function createSqliteConnection() {
  const sqlite = new Database(config.DATABASE_PATH, {
    verbose: isDev ? console.log : undefined,
  });

  // Enable foreign keys (critical for referential integrity)
  sqlite.pragma('foreign_keys = ON');

  // Performance optimizations for WAL mode
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('cache_size = -64000'); // 64MB cache

  return sqlite;
}

/**
 * Run database migrations
 */
export function migrateDatabase(db: BetterSQLite3Database<typeof schema>) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  // In both src/db/client.ts (dev) and dist/db/client.js (prod),
  // the drizzle folder is at ../../drizzle relative to this file
  const migrationsFolder = resolve(__dirname, '../../drizzle');

  console.log('Running migrations from:', migrationsFolder);

  migrate(db, { migrationsFolder });
}

/**
 * Database instance type
 */
export interface DatabaseInstance {
  db: BetterSQLite3Database<typeof schema>;
  sqlite: Database.Database;
}

/**
 * Initialize database connection
 */
export async function initializeDatabase(): Promise<DatabaseInstance> {
  await ensureDatabaseDirectory();
  let sqlite = createSqliteConnection();

  // Check for inconsistent migration state (tables exist but not tracked)
  const consistency = checkMigrationConsistency(sqlite);

  if (consistency.isInconsistent) {
    if (isDev) {
      console.warn(
        '⚠️  Database has tables but no migration tracking. ' +
          'This usually happens when db:push was used instead of migrations.',
      );
      await resetDatabase(sqlite);
      // Recreate connection after reset
      sqlite = createSqliteConnection();
    } else {
      throw new Error(
        'Database is in an inconsistent state: tables exist but migrations are not tracked. ' +
          'This can happen if db:push was used instead of migrations. ' +
          'In production, please either:\n' +
          '1. Delete the database and let migrations recreate it, or\n' +
          '2. Manually mark migrations as applied in __drizzle_migrations table.',
      );
    }
  }

  const db = drizzle(sqlite, { schema });

  // Run migrations on startup
  migrateDatabase(db);

  return { db, sqlite };
}

/**
 * Global database instance (singleton)
 * Initialized on first use
 */
let dbInstance: DatabaseInstance | null = null;

/**
 * Get database instance (creates on first call)
 */
export async function getDatabase(): Promise<DatabaseInstance> {
  dbInstance ??= await initializeDatabase();
  return dbInstance;
}

/**
 * Close database connection
 */
export function closeDatabase() {
  if (dbInstance) {
    dbInstance.sqlite.close();
    dbInstance = null;
  }
}
