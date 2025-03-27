const sqlite3 = require('sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'slabs.db');
const db = new sqlite3.Database(dbPath);

const sql = fs.readFileSync(path.join(__dirname, '../src/db/migrations/20240618123000_add_google_sync_fields.sql'), 'utf8');

db.exec(sql, (err) => {
  if (err) {
    console.error('Error executing migration:', err);
    process.exit(1);
  }
  console.log('Migration completed successfully');
  db.close();
});