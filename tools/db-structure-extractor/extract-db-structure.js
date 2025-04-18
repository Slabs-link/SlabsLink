/**
 * Script per estrarre la struttura completa del database SQLite
 * Questo script estrae tutte le tabelle, colonne, tipi di dati e vincoli
 */

const { getDatabase } = require('./server/dist/config/database-sqlite');

try {
  console.log('Inizializzazione connessione al database SQLite...');
  const db = getDatabase();
  
  // Abilita le foreign keys
  db.pragma('foreign_keys = ON');
  
  // 1. Ottieni tutte le tabelle
  console.log('\n=== STRUTTURA DEL DATABASE ===\n');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  
  if (tables.length === 0) {
    console.log('Il database non contiene tabelle o non è stato inizializzato.');
    console.log('\nDefinizioni delle tabelle dalle migrazioni:');
    
    // Mostra le definizioni delle tabelle dalle migrazioni
    console.log('\n--- TABELLA: users ---');
    console.log(`
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
    `);
    
    console.log('\n--- TABELLA: appointments ---');
    console.log(`
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
        FOREIGN KEY (patient_id) REFERENCES users(id)
      )
    `);
    
    console.log('\n--- TABELLA: appointment_types ---');
    console.log(`
      CREATE TABLE IF NOT EXISTS appointment_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    
    console.log('\n--- TABELLA: notification_templates ---');
    console.log(`
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
    `);
    
    console.log('\n--- TABELLA: notifications ---');
    console.log(`
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
    `);
    
    console.log('\n--- TABELLA: app_settings ---');
    console.log(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT,
        description TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    
    console.log('\n--- TABELLA: comuni ---');
    console.log(`
      CREATE TABLE IF NOT EXISTS comuni (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        codice TEXT NOT NULL,
        provincia TEXT,
        regione TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    
    console.log('\n--- TABELLA: licenses ---');
    console.log(`
      CREATE TABLE licenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        license_key TEXT NOT NULL UNIQUE,
        activation_date TEXT,
        expiration_date TEXT,
        status TEXT DEFAULT 'inactive',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    
  } else {
    // Itera su tutte le tabelle e mostra la loro struttura
    for (const table of tables) {
      console.log(`\n--- TABELLA: ${table.name} ---`);
      
      // Ottieni la definizione SQL della tabella
      const tableInfo = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(table.name);
      console.log(tableInfo.sql);
      
      // Ottieni informazioni sulle colonne
      console.log('\nColonne:');
      const columns = db.prepare(`PRAGMA table_info(${table.name})`).all();
      columns.forEach(col => {
        const notNull = col.notnull ? 'NOT NULL' : 'NULL';
        const defaultValue = col.dflt_value ? `DEFAULT ${col.dflt_value}` : '';
        const primaryKey = col.pk ? 'PRIMARY KEY' : '';
        console.log(`  ${col.name} (${col.type}) ${notNull} ${defaultValue} ${primaryKey}`.trim());
      });
      
      // Ottieni informazioni sugli indici
      console.log('\nIndici:');
      const indices = db.prepare(`PRAGMA index_list(${table.name})`).all();
      if (indices.length === 0) {
        console.log('  Nessun indice definito');
      } else {
        indices.forEach(idx => {
          const indexInfo = db.prepare(`PRAGMA index_info(${idx.name})`).all();
          const columns = indexInfo.map(ii => ii.name).join(', ');
          console.log(`  ${idx.name} (${columns}) ${idx.unique ? 'UNIQUE' : ''}`.trim());
        });
      }
      
      // Ottieni informazioni sulle foreign keys
      console.log('\nForeign Keys:');
      const foreignKeys = db.prepare(`PRAGMA foreign_key_list(${table.name})`).all();
      if (foreignKeys.length === 0) {
        console.log('  Nessuna foreign key definita');
      } else {
        foreignKeys.forEach(fk => {
          console.log(`  ${fk.from} -> ${fk.table}(${fk.to})`);
        });
      }
    }
  }
  
  console.log('\n=== FINE STRUTTURA DEL DATABASE ===');
  
} catch (err) {
  console.error('Errore durante l\'estrazione della struttura del database:', err);
  process.exit(1);
}