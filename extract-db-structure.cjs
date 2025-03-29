/**
 * Script per estrarre la struttura completa del database SQLite
 * Questo script estrae tutte le tabelle, colonne, tipi di dati e vincoli
 * direttamente dal file del database, senza dipendere dai moduli del server.
 */

const BetterSqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Funzione per formattare il testo SQL
function formatSql(sql) {
  return sql
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/,\s+/g, ', ')
    .trim();
}

// Funzione principale per estrarre la struttura del database
function extractDatabaseStructure(dbPath) {
  try {
    console.log(`Inizializzazione connessione al database SQLite: ${dbPath}...`);
    
    // Verifica che il file del database esista
    if (!fs.existsSync(dbPath)) {
      console.error(`Errore: Il file del database ${dbPath} non esiste.`);
      console.log('\nDatabase disponibili:');
      
      // Cerca file .db nella directory corrente e nelle sottodirectory data
      const currentDir = process.cwd();
      const dataDir = path.join(currentDir, 'data');
      const serverDataDir = path.join(currentDir, 'server', 'data');
      
      let dbFiles = [];
      
      // Controlla nella directory corrente
      try {
        const files = fs.readdirSync(currentDir);
        dbFiles = dbFiles.concat(files.filter(f => f.endsWith('.db')).map(f => path.join(currentDir, f)));
      } catch (err) {
        console.error(`Errore nella lettura della directory ${currentDir}:`, err.message);
      }
      
      // Controlla nella directory data
      if (fs.existsSync(dataDir)) {
        try {
          const files = fs.readdirSync(dataDir);
          dbFiles = dbFiles.concat(files.filter(f => f.endsWith('.db')).map(f => path.join(dataDir, f)));
        } catch (err) {
          console.error(`Errore nella lettura della directory ${dataDir}:`, err.message);
        }
      }
      
      // Controlla nella directory server/data
      if (fs.existsSync(serverDataDir)) {
        try {
          const files = fs.readdirSync(serverDataDir);
          dbFiles = dbFiles.concat(files.filter(f => f.endsWith('.db')).map(f => path.join(serverDataDir, f)));
        } catch (err) {
          console.error(`Errore nella lettura della directory ${serverDataDir}:`, err.message);
        }
      }
      
      if (dbFiles.length > 0) {
        console.log('Database trovati:');
        dbFiles.forEach((file, index) => {
          console.log(`  ${index + 1}. ${file}`);
        });
        console.log('\nEsegui lo script specificando il percorso del database:');
        console.log('  node extract-db-structure.cjs <percorso-database>');
      } else {
        console.log('Nessun database (.db) trovato nelle directory principali.');
      }
      
      process.exit(1);
    }
    
    // Connessione al database
    const db = new BetterSqlite3(dbPath, { readonly: true });
    
    // Abilita le foreign keys
    db.pragma('foreign_keys = ON');
    
    // 1. Ottieni tutte le tabelle
    console.log('\n=== STRUTTURA DEL DATABASE ===\n');
    console.log(`Database: ${dbPath}\n`);
    
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    
    if (tables.length === 0) {
      console.log('Il database non contiene tabelle o non è stato inizializzato.');
    } else {
      // Itera su tutte le tabelle e mostra la loro struttura
      for (const table of tables) {
        console.log(`\n--- TABELLA: ${table.name} ---`);
        
        // Ottieni la definizione SQL della tabella
        const tableInfo = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(table.name);
        console.log(formatSql(tableInfo.sql));
        
        // Ottieni informazioni sulle colonne
        console.log('\nColonne:');
        const columns = db.prepare(`PRAGMA table_info(${table.name})`).all();
        columns.forEach(col => {
          const notNull = col.notnull ? 'NOT NULL' : 'NULL';
          const defaultValue = col.dflt_value ? `DEFAULT ${col.dflt_value}` : '';
          const primaryKey = col.pk ? 'PRIMARY KEY' : '';
          
          // Evidenzia i campi importanti per Google Calendar nella tabella appointments
          let highlight = '';
          if (table.name === 'appointments' && 
              ['google_calendar_event_id', 'synced', 'start_time', 'end_time', 'appointment_type_id'].includes(col.name)) {
            highlight = ' [IMPORTANTE PER GOOGLE CALENDAR]';
          }
          
          console.log(`  ${col.name} (${col.type}) ${notNull} ${defaultValue} ${primaryKey}${highlight}`.trim());
        });
        
        // Se è la tabella appointments, mostra un messaggio informativo sui campi per Google Calendar
        if (table.name === 'appointments') {
          console.log('\nCampi per Google Calendar:');
          console.log('  google_calendar_event_id: ID dell\'evento in Google Calendar');
          console.log('  synced: Stato di sincronizzazione con Google Calendar (0=non sincronizzato, 1=sincronizzato)');
          console.log('  start_time: Data e ora di inizio in formato ISO');
          console.log('  end_time: Data e ora di fine in formato ISO');
          console.log('  appointment_type_id: Riferimento al tipo di appuntamento');
        }
        
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
        
        // Ottieni il numero di righe nella tabella
        try {
          const countResult = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
          console.log(`\nNumero di righe: ${countResult.count}`);
        } catch (err) {
          console.log(`\nImpossibile contare le righe: ${err.message}`);
        }
      }
    }
    
    // Ottieni informazioni sulle viste
    const views = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='view'").all();
    if (views.length > 0) {
      console.log('\n=== VISTE ===');
      for (const view of views) {
        console.log(`\n--- VISTA: ${view.name} ---`);
        console.log(formatSql(view.sql));
      }
    }
    
    // Ottieni informazioni sui trigger
    const triggers = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='trigger'").all();
    if (triggers.length > 0) {
      console.log('\n=== TRIGGER ===');
      for (const trigger of triggers) {
        console.log(`\n--- TRIGGER: ${trigger.name} ---`);
        console.log(formatSql(trigger.sql));
      }
    }
    
    console.log('\n=== FINE STRUTTURA DEL DATABASE ===');
    
    // Chiudi la connessione al database
    db.close();
    
  } catch (err) {
    console.error('Errore durante l\'estrazione della struttura del database:', err);
    process.exit(1);
  }
}

// Punto di ingresso dello script
function main() {
  // Ottieni il percorso del database dagli argomenti della riga di comando
  let dbPath = process.argv[2];
  
  // Se non è specificato un percorso, usa il percorso predefinito
  if (!dbPath) {
    // Cerca prima nella directory data
    const defaultPath = path.join(process.cwd(), 'data', 'slabs.db');
    const serverPath = path.join(process.cwd(), 'server', 'data', 'slabs.db');
    const rootPath = path.join(process.cwd(), 'slabs.db');
    
    if (fs.existsSync(defaultPath)) {
      dbPath = defaultPath;
    } else if (fs.existsSync(serverPath)) {
      dbPath = serverPath;
    } else if (fs.existsSync(rootPath)) {
      dbPath = rootPath;
    } else {
      console.error('Errore: Percorso del database non specificato e nessun database predefinito trovato.');
      console.log('Utilizzo: node extract-db-structure.cjs [percorso-database]');
      process.exit(1);
    }
  }
  
  // Estrai la struttura del database
  extractDatabaseStructure(dbPath);
}

// Esegui lo script
main();