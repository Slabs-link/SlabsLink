import fs from 'fs';
import path from 'path';
import { getDatabase } from '../../config/database-sqlite';

// Funzione per eseguire le migrazioni SQLite
export const runSqliteMigrations = async (): Promise<boolean> => {
  try {
    console.log('Esecuzione migrazioni SQLite...');
    const db = getDatabase();
    
    // Abilita le foreign keys
    db.pragma('foreign_keys = ON');
    
    // Crea la tabella users se non esiste
    db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT UNIQUE,
        phone TEXT,
        birth_date TEXT,
        gender TEXT,
        fiscal_code TEXT,
        address TEXT,
        city TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `).run();
    
    // Crea la tabella appointments se non esiste
    db.prepare(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        patient_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        duration INTEGER NOT NULL,
        notes TEXT,
        synced INTEGER DEFAULT 0,
        status TEXT DEFAULT 'scheduled',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        appointment_type_id INTEGER,
        google_calendar_event_id TEXT,
        start_time TEXT,
        end_time TEXT,
        FOREIGN KEY (patient_id) REFERENCES users(id)
      )
    `).run();
    
    // Crea la tabella notification_templates se non esiste
    db.prepare(`
      CREATE TABLE IF NOT EXISTS notification_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        description TEXT,
        is_system INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `).run();
    
    // Crea la tabella notifications se non esiste
    db.prepare(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        error_message TEXT,
        template_id INTEGER,
        appointment_id INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (template_id) REFERENCES notification_templates(id),
        FOREIGN KEY (appointment_id) REFERENCES appointments(id)
      )
    `).run();
    
    // Inserisci i template di notifica di sistema se non esistono
    interface CountResult {
      count: number;
    }
    
    const templateExists = db.prepare(`SELECT COUNT(*) as count FROM notification_templates WHERE is_system = 1`).get() as CountResult;
    
    if (templateExists.count === 0) {
      console.log('Inserimento template di notifica di sistema...');
      
      const insertTemplate = db.prepare(`
        INSERT INTO notification_templates (name, type, content, description, is_system)
        VALUES (?, ?, ?, ?, 1)
      `);
      
      // Template per appuntamento creato
      insertTemplate.run(
        'Appuntamento Creato',
        'appointment_created',
        'Gentile {first_name} {last_name}, le confermiamo che è stato fissato un appuntamento per il giorno {appointment_date} alle ore {appointment_time}.',
        'Template per la notifica di creazione appuntamento'
      );
      
      // Template per appuntamento aggiornato
      insertTemplate.run(
        'Appuntamento Aggiornato',
        'appointment_update',
        'Gentile {first_name} {last_name}, le comunichiamo che il suo appuntamento è stato modificato per il giorno {appointment_date} alle ore {appointment_time}.',
        'Template per la notifica di aggiornamento appuntamento'
      );
      
      // Template per appuntamento cancellato
      insertTemplate.run(
        'Appuntamento Cancellato',
        'appointment_cancellation',
        'Gentile {first_name} {last_name}, le comunichiamo che il suo appuntamento del giorno {appointment_date} alle ore {appointment_time} è stato cancellato.',
        'Template per la notifica di cancellazione appuntamento'
      );
      
      // Template per promemoria appuntamento
      insertTemplate.run(
        'Promemoria Appuntamento',
        'appointment_reminder',
        'Gentile {first_name} {last_name}, le ricordiamo che ha un appuntamento fissato per domani, {appointment_date} alle ore {appointment_time}.',
        'Template per il promemoria di appuntamento'
      );
    }
    
    console.log('Migrazioni SQLite completate con successo');
    return true;
  } catch (error) {
    console.error('Errore durante l\'esecuzione delle migrazioni SQLite:', error);
    return false;
  }
};