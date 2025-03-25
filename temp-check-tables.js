const db = require('./database/db');

db.get('SELECT name FROM sqlite_master WHERE type="table"')
  .then(tables => {
    console.log('Tabelle presenti nel database:', tables);
    process.exit(0);
  })
  .catch(err => {
    console.error('Errore durante il recupero delle tabelle:', err);
    process.exit(1);
  });