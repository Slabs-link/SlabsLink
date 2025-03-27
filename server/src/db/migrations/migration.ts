import { Database } from 'sqlite3';
import { getDatabase as getDb } from '../../config/database';

export const getDatabase = () => getDb();

export abstract class Migration {
  protected db: Database;
  abstract name: string;

  constructor(db: Database) {
    this.db = db;
  }

  abstract up(): Promise<void>;
  abstract down(): Promise<void>;
}