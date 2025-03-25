import { getDatabase } from '../config/database-sqlite';

// Export getDatabase function to be used by other modules
export { getDatabase };

// Inizializza il database SQLite
export const initDatabase = () => {
  try {
    console.log('Inizializzazione database SQLite...');
    const db = getDatabase();
    
    // Test della connessione
    interface TimeResult {
      now: string;
    }
    
    const result = db.prepare('SELECT datetime("now") as now').get() as TimeResult;
    console.log('Connessione al database SQLite riuscita, ora corrente:', result.now);
    
    console.log('Database SQLite inizializzato');
    return db;
  } catch (error) {
    console.error('Errore durante l\'inizializzazione del database SQLite:', error);
    return null;
  }
};

// Ottieni l'istanza del database
export const getDb = () => {
  return getDatabase();
};

// Chiudi la connessione al database
export const closeDatabase = () => {
  try {
    const { closeDatabase } = require('../config/database-sqlite');
    closeDatabase();
    console.log('Connessione al database SQLite chiusa');
  } catch (error) {
    console.error('Errore durante la chiusura del database SQLite:', error);
  }
};