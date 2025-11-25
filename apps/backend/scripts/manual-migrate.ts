import Database from 'better-sqlite3';
import { resolve } from 'path';

let dbPath = process.env['DATABASE_URL'] ?? './data/sqlite/db.sqlite';
if (dbPath.startsWith('file:')) {
  dbPath = dbPath.slice(5);
}

const db = new Database(resolve(dbPath));

console.log('Connected to database at', dbPath);

// 1. Create location_revisions table
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS location_revisions (
      id text PRIMARY KEY NOT NULL,
      location_id text NOT NULL REFERENCES locations(id) ON DELETE cascade,
      type text NOT NULL,
      snapshot blob,
      created_at integer DEFAULT (unixepoch()) NOT NULL
    );
  `);
  console.log('Created location_revisions table');

  db.exec(`
    CREATE INDEX IF NOT EXISTS location_revisions_location_created_idx 
    ON location_revisions (location_id, created_at);
  `);
  console.log('Created index on location_revisions');
} catch (err) {
  console.error('Error creating location_revisions:', err);
}

// 2. Check location_vertices schema
interface TableColumn {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: unknown;
  pk: number;
}

try {
  const tableInfo = db.prepare("PRAGMA table_info(location_vertices)").all() as TableColumn[];
  console.log('Current location_vertices columns:', tableInfo.map(c => `${c.name} (${c.type})`).join(', '));
} catch (err) {
  console.error('Error checking location_vertices:', err);
}

db.close();
