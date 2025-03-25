import { getDatabase } from '../../config/database-sqlite';
import * as fs from 'fs';
import * as path from 'path';
import { addGoogleCalendarFields } from './add-google-calendar-fields';

/**
 * Esegue tutte le migrazioni SQL relative a Google Calendar
 */
export async function runGoogleCalendarMigrations(): Promise<void> {
  try {
    const db = getDatabase();
    
    // Esegui la migrazione TypeScript esistente
    await addGoogleCalendarFields();
    
    // Elenco dei file di migrazione SQL da eseguire in ordine
    const sqlMigrations = [
      'google_calendar_migrations_combined.sql'
    ];
    
    // Esegui ogni file di migrazione SQL
    for (const migrationFile of sqlMigrations) {
      const filePath = path.join(__dirname, migrationFile);
      
      if (fs.existsSync(filePath)) {
        const sql = fs.readFileSync(filePath, 'utf8');
        
        // Dividi il file in singole istruzioni SQL
        const statements = sql
          .split(';')
          .map(statement => statement.trim())
          .filter(statement => statement.length > 0);
        
        // Esegui ogni istruzione SQL
        for (const statement of statements) {
          db.prepare(statement).run();
        }
        
        console.log(`Migrazione ${migrationFile} eseguita con successo`);
      } else {
        console.warn(`File di migrazione ${migrationFile} non trovato`);
      }
    }
    
    console.log('Tutte le migrazioni di Google Calendar completate con successo');
  } catch (error) {
    console.error('Errore durante l\'esecuzione delle migrazioni di Google Calendar:', error);
    throw error;
  }
}

// Esegui la migrazione se questo file viene eseguito direttamente
if (require.main === module) {
  runGoogleCalendarMigrations()
    .then(() => {
      console.log('Migrazioni completate');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Errore durante le migrazioni:', error);
      process.exit(1);
    });
}