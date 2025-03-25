"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeDatabase = exports.getDb = exports.initDatabase = exports.getDatabase = void 0;
const database_sqlite_1 = require("../config/database-sqlite");
Object.defineProperty(exports, "getDatabase", { enumerable: true, get: function () { return database_sqlite_1.getDatabase; } });
// Inizializza il database SQLite
const initDatabase = () => {
    try {
        console.log('Inizializzazione database SQLite...');
        const db = (0, database_sqlite_1.getDatabase)();
        const result = db.prepare('SELECT datetime("now") as now').get();
        console.log('Connessione al database SQLite riuscita, ora corrente:', result.now);
        console.log('Database SQLite inizializzato');
        return db;
    }
    catch (error) {
        console.error('Errore durante l\'inizializzazione del database SQLite:', error);
        return null;
    }
};
exports.initDatabase = initDatabase;
// Ottieni l'istanza del database
const getDb = () => {
    return (0, database_sqlite_1.getDatabase)();
};
exports.getDb = getDb;
// Chiudi la connessione al database
const closeDatabase = () => {
    try {
        const { closeDatabase } = require('../config/database-sqlite');
        closeDatabase();
        console.log('Connessione al database SQLite chiusa');
    }
    catch (error) {
        console.error('Errore durante la chiusura del database SQLite:', error);
    }
};
exports.closeDatabase = closeDatabase;
