import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import { initializeDatabase } from './init-database';

// Database manager class
export class DatabaseManager {
  private static instance: BetterSqlite3.Database | null = null;

  static getInstance(): BetterSqlite3.Database {
    if (!this.instance) {
      try {
        // Initialize the database if needed
        initializeDatabase();
        
        // Connect to the existing database
        const dbPath = path.resolve(__dirname, '../../data/slabs.db');
        console.log(`Connecting to database at: ${dbPath}`);
        // Rimuovo verbose: console.log per evitare log eccessivi di query SQL nel terminale
        this.instance = new BetterSqlite3(dbPath);
        // Log database connection for debugging
        console.log(`Database connection established at: ${dbPath}`);
        console.log('Database instance created successfully');
        
        // Enable foreign keys
        this.instance.pragma('foreign_keys = ON');
      } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
      }
    }
    
    return this.instance;
  }

  static closeConnection(): void {
    if (this.instance) {
      this.instance.close();
      this.instance = null;
      console.log('Database connection closed');
    }
  }
}

// Function to get the database instance
export function getDatabase(): BetterSqlite3.Database {
  return DatabaseManager.getInstance();
}

// Function to close the database connection
export function closeDatabase(): void {
  DatabaseManager.closeConnection();
}

// Function to check database connection
export function checkDatabaseConnection(): boolean {
  try {
    const db = getDatabase();
    // Execute a simple query to check if the connection is working
    db.prepare('SELECT 1').get();
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}