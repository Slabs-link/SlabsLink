import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { getDatabase } from './database-sqlite';
import { addGoogleCalendarFields } from '../db/migrations/add-google-calendar-fields';

// Define the Comune type
type Comune = {
  nome: string;
  codice: string;
  provincia: string;
};

// Define a more flexible type for parsing JSON
type ComuneInput = {
  [key: string]: any;
};

// Function to initialize the database
export function initializeDatabase() {
  console.log('Initializing database...');
  
  // Use the existing database path
  const dbPath = path.resolve(__dirname, '../../data/slabs.db');
  console.log(`Using existing database at: ${dbPath}`);
  
  // Ensure the database file exists
  if (!fs.existsSync(dbPath)) {
    console.error(`Database file not found at: ${dbPath}`);
    throw new Error('Database file not found');
  }
  
  // Load comuni from JSON file
  const comuniJsonPath = path.resolve(__dirname, '../../data/comuni.json');
  console.log(`Loading comuni from: ${comuniJsonPath}`);
  
  if (!fs.existsSync(comuniJsonPath)) {
    console.error(`Comuni JSON file not found at: ${comuniJsonPath}`);
    throw new Error('Comuni JSON file not found');
  }
  
  // Read and parse the JSON file with better error handling
  let comuniInput: ComuneInput[] = [];
  try {
    const jsonContent = fs.readFileSync(comuniJsonPath, 'utf8');
    const comuniData = JSON.parse(jsonContent);
    
    // Handle different possible JSON structures
    if (Array.isArray(comuniData)) {
      comuniInput = comuniData;
    } else if (comuniData.comuni && Array.isArray(comuniData.comuni)) {
      comuniInput = comuniData.comuni;
    } else {
      // Try to extract comuni from any property that might be an array
      const possibleArrays = Object.values(comuniData).filter(val => Array.isArray(val));
      if (possibleArrays.length > 0) {
        comuniInput = possibleArrays[0] as ComuneInput[];
      }
    }
    
    console.log(`Loaded ${comuniInput.length} comuni from JSON file`);
  } catch (error) {
    console.error('Error parsing JSON file:', error);
    throw new Error('Failed to parse comuni JSON file');
  }
  
  // Map the input data to the Comune type
  const comuni: Comune[] = comuniInput.map(item => {
    return {
      nome: item.nome || '',
      codice: item.codice || '',
      provincia: item.provincia || ''
    };
  }).filter(comune => comune.nome && comune.codice && comune.provincia);
  
  console.log(`Mapped ${comuni.length} valid comuni entries`);
  
  // Always recreate and repopulate the table to ensure it's up to date
  const db = new BetterSqlite3(dbPath);
  
  // Create the comuni table if it doesn't exist
  console.log('Creating comuni table if it doesn\'t exist');
  db.exec(`
    CREATE TABLE IF NOT EXISTS comuni (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      codice TEXT NOT NULL,
      provincia TEXT NOT NULL
    )
  `);
  
  // Clear the table and repopulate it
  console.log('Clearing existing comuni data');
  db.exec('DELETE FROM comuni');
  
  if (comuni.length > 0) {
    console.log('Populating comuni table with data from JSON file');
    
    const insert = db.prepare('INSERT INTO comuni (nome, codice, provincia) VALUES (?, ?, ?)');
    
    // Use a transaction for better performance
    const insertMany = db.transaction((comuniList: Comune[]) => {
      for (const comune of comuniList) {
        insert.run(comune.nome, comune.codice, comune.provincia);
      }
    });
    
    try {
      insertMany(comuni);
      console.log(`Added ${comuni.length} comuni to the database`);
    } catch (error) {
      console.error('Error inserting comuni into database:', error);
      throw error;
    }
  } else {
    console.warn('No valid comuni found in the JSON file');
  }
  
  // Close the database connection
  db.close();
  console.log('Database initialization complete');
}

// Run the initialization if this file is executed directly
if (require.main === module) {
  initializeDatabase();
}