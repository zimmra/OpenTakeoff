/**
 * Database Client
 * SQLite connection with Drizzle ORM
 */

import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { config, isDev } from '../config.js';
import * as schema from './schema.js';
import { mkdir } from 'node:fs/promises';
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
  const sqlite = createSqliteConnection();
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
