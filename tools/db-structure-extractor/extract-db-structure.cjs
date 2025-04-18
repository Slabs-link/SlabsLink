const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

// Percorso del file di output
const outputFile = path.join(__dirname, 'situazione-db.txt');

// Funzione per scrivere l'output su file
function writeToFile(data) {
  try {
    fs.writeFileSync(outputFile, data);
    console.log(`\nOutput salvato in: ${outputFile}`);
  } catch (err) {
    console.error('Errore durante il salvataggio del file:', err);
  }
}

// Funzione per estrarre la struttura del database
function extractDbStructure(dbPath) {
  const db = new sqlite3.Database(dbPath);
  
  return new Promise((resolve, reject) => {
    db.all("SELECT name FROM sqlite_master WHERE type='table';", [], (err, tables) => {
      if (err) {
        reject(err);
        return;
      }
      
      let output = 'Struttura del database:\n\n';

      console.log(tables); // Aggiungi questa riga per visualizzare il contenuto di tables
      
      const promises = tables.map(table => {
        return new Promise((resolve) => {
          db.all(`PRAGMA table_info(${table.name});`, [], (err, columns) => {
            if (err) {
              console.log(`Errore durante l'estrazione della struttura della tabella ${table.name}:`, err);
              output += `Errore durante l'estrazione della struttura della tabella ${table.name}: ${err}\n`;
              resolve();
              return;
            }
            
            output += `Tabella: ${table.name}\n`;
            output += 'Colonne:\n';
            
            columns.forEach(col => {
              output += `- ${col.name}: ${col.type}${col.pk ? ' (PRIMARY KEY)' : ''}\n`;
            });
            
            output += '\n';
            resolve();
          });
        });
      });
      
      Promise.all(promises).then(() => {
        resolve(output);
      });
    });
  });
}

// Esegui l'estrazione e salva il risultato
if (process.argv.length < 3) {
  console.error('Specificare il percorso del database come argomento');
  process.exit(1);
}

const dbPath = process.argv[2];
extractDbStructure(dbPath)
  .then(output => {
    console.log(output);
    writeToFile(output);
  })
  .catch(err => {
    console.error('Errore durante l\'estrazione della struttura:', err);
    process.exit(1);
  });