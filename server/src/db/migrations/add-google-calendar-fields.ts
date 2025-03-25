import { getDatabase } from '../../config/database-sqlite';

/**
 * Migrazione per aggiungere i campi necessari per la sincronizzazione con Google Calendar
 * alla tabella degli appuntamenti
 */
export async function addGoogleCalendarFields(): Promise<void> {
  try {
    const db = getDatabase();
    
    // Verifica se la tabella appointments esiste
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='appointments'
    `).get();
    
    if (!tableExists) {
      console.error('La tabella appointments non esiste');
      return;
    }
    
    // Verifica se la colonna google_calendar_event_id esiste già
    const columnExists = db.prepare(`
      PRAGMA table_info(appointments)
    `).all().some((column: any) => column.name === 'google_calendar_event_id');
    
    if (!columnExists) {
      // Aggiungi la colonna google_calendar_event_id
      db.prepare(`
        ALTER TABLE appointments 
        ADD COLUMN google_calendar_event_id TEXT
      `).run();
      
      console.log('Colonna google_calendar_event_id aggiunta alla tabella appointments');
    }
    
    // Verifica se la colonna synced esiste già
    const syncedColumnExists = db.prepare(`
      PRAGMA table_info(appointments)
    `).all().some((column: any) => column.name === 'synced');
    
    if (!syncedColumnExists) {
      // Aggiungi la colonna synced
      db.prepare(`
        ALTER TABLE appointments 
        ADD COLUMN synced INTEGER DEFAULT 0
      `).run();
      
      console.log('Colonna synced aggiunta alla tabella appointments');
    }
    
    console.log('Migrazione completata con successo');
  } catch (error) {
    console.error('Errore durante la migrazione:', error);
    throw error;
  }
}

// Esegui la migrazione se questo file viene eseguito direttamente
if (require.main === module) {
  addGoogleCalendarFields()
    .then(() => {
      console.log('Migrazione completata');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Errore durante la migrazione:', error);
      process.exit(1);
    });
}