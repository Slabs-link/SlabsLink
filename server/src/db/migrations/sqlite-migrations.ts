import fs from 'fs';
import path from 'path';
import { getDatabase } from '../../config/database-sqlite';

// Funzione per eseguire le migrazioni SQLite basate sulla struttura definita
export const runSqliteMigrations = async (): Promise<boolean> => {
  try {
    console.log('Verifica e applicazione struttura database SQLite...');
    const db = getDatabase();

    // Abilita le foreign keys
    db.pragma('foreign_keys = ON');

    // Array di statement SQL per creare le tabelle (derivati da situazione-db.txt)
    // Nota: Questi statement sono stati adattati basandosi sul file situazione-db.txt 
    // e confrontati con le migrazioni originali per mantenere coerenza (es. NOT NULL, defaults, foreign keys).
    const createTableStatements = [
      `CREATE TABLE IF NOT EXISTS users (
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
        updated_at TEXT DEFAULT (datetime('now')),
        birth_city_code VARCHAR(10),
        birth_city TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS comuni (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT,
        codice TEXT,
        provincia TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS appointment_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        description TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS licenses (
        id TEXT PRIMARY KEY,
        key TEXT,
        expiration_date TEXT,
        features TEXT,
        active INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS appointments (
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
      );`,
      `CREATE TABLE IF NOT EXISTS user_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        file_name TEXT,
        original_name TEXT,
        file_path TEXT,
        file_type TEXT,
        file_size INTEGER,
        description TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );`,
      `CREATE TABLE IF NOT EXISTS notification_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        description TEXT,
        is_system INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS notifications (
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
      );`,
      `CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );`
    ];

    // Esegui gli statement per creare le tabelle
    // Usiamo db.exec per eseguire tutti gli statement in una volta sola
    // Nota: db.exec non supporta parametri, ma qui non servono.
    // L'uso di `CREATE TABLE IF NOT EXISTS` gestisce l'esistenza delle tabelle.
    try {
      db.exec(createTableStatements.join('\n'));
      console.log('Struttura tabelle verificata/applicata con successo.');
    } catch (tableError) {
      console.error('Errore durante la creazione/verifica delle tabelle:', tableError);
      throw tableError; // Rilancia l'errore per fermare l'esecuzione
    }

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

      const systemTemplates = [
        {
          name: 'Appuntamento Creato',
          type: 'appointment_created',
          content: 'Gentile {first_name} {last_name}, le confermiamo che è stato fissato un appuntamento per il giorno {appointment_date} alle ore {appointment_time}.',
          description: 'Template per la notifica di creazione appuntamento'
        },
        {
          name: 'Appuntamento Aggiornato',
          type: 'appointment_update',
          content: 'Gentile {first_name} {last_name}, le comunichiamo che il suo appuntamento è stato modificato per il giorno {appointment_date} alle ore {appointment_time}.',
          description: 'Template per la notifica di aggiornamento appuntamento'
        },
        {
          name: 'Appuntamento Cancellato',
          type: 'appointment_cancellation',
          content: 'Gentile {first_name} {last_name}, le comunichiamo che il suo appuntamento del giorno {appointment_date} alle ore {appointment_time} è stato cancellato.',
          description: 'Template per la notifica di cancellazione appuntamento'
        },
        {
          name: 'Promemoria Appuntamento',
          type: 'appointment_reminder',
          content: 'Gentile {first_name} {last_name}, le ricordiamo che ha un appuntamento fissato per domani, {appointment_date} alle ore {appointment_time}.',
          description: 'Template per il promemoria di appuntamento'
        }
      ];

      // Usa una transazione per inserire i template
      db.transaction(() => {
        systemTemplates.forEach(template => {
          insertTemplate.run(template.name, template.type, template.content, template.description);
        });
      })();
      console.log('Template di notifica di sistema inseriti.');
    } else {
      console.log('Template di notifica di sistema già presenti.');
    }

    console.log('Migrazioni/Verifica struttura SQLite completate con successo.');
    return true;
  } catch (error) {
    console.error('Errore durante l\'esecuzione delle migrazioni/verifica struttura SQLite:', error);
    return false;
  }
};