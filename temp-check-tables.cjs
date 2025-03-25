const { getDatabase } = require('./server/dist/config/database-sqlite');
const db = getDatabase();

try {
  const stmt = db.prepare('SELECT name FROM sqlite_master WHERE type=\'table\'');
  const tables = stmt.all();
  console.log('Tabelle presenti nel database:', tables);
  process.exit(0);
} catch (err) {
  console.error('Errore durante il recupero delle tabelle:', err);
  process.exit(1);
}