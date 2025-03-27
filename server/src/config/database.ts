import { Database, open } from 'sqlite';
import * as sqlite3 from 'sqlite3';

let dbInstance: Database;

const dbPath = process.env.DB_PATH || './data/slabs.db';

export function getDatabase(): Database {
  if (!dbInstance) {
    throw new Error('Database non inizializzato');
  }
  return dbInstance;
}

export async function initializeDatabase(): Promise<void> {
  dbInstance = await open({
  filename: dbPath,
  driver: sqlite3.Database,
  mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE | sqlite3.OPEN_FULLMUTEX,
});

  await dbInstance.run('PRAGMA foreign_keys = ON');
}