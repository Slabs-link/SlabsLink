"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeDatabase = exports.getDatabaseConfig = exports.initializeDatabase = exports.checkDatabaseConnection = exports.getDatabase = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Singleton class to manage SQLite database connection
class DatabaseManager {
    constructor() {
        this.db = null;
        this.isConfigured = false;
        this.dbPath = path_1.default.join(process.cwd(), 'data', 'slabs.db');
    }
    static getInstance() {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new DatabaseManager();
        }
        return DatabaseManager.instance;
    }
    getDatabase() {
        if (!this.db) {
            this.initDatabase();
        }
        return this.db;
    }
    initDatabase(config) {
        console.log('Inizializzazione database SQLite con configurazione', config ? 'personalizzata' : 'predefinita');
        // Ensure the data directory exists
        const dataDir = path_1.default.dirname(this.dbPath);
        if (!fs_1.default.existsSync(dataDir)) {
            fs_1.default.mkdirSync(dataDir, { recursive: true });
        }
        // If custom config is provided, use it
        if (config === null || config === void 0 ? void 0 : config.dbPath) {
            this.dbPath = config.dbPath;
        }
        // Create SQLite database connection
        const sqlite3 = require('better-sqlite3');
        this.db = new sqlite3(this.dbPath, { verbose: console.log });
        // Enable foreign keys
        if (this.db) {
            this.db.pragma('foreign_keys = ON');
        }
        // If this is a custom config, mark as configured
        if (config) {
            this.isConfigured = true;
        }
    }
    closeDatabase() {
        if (!this.db) {
            return;
        }
        try {
            this.db.close();
            this.db = null;
            console.log('Database chiuso correttamente');
        }
        catch (error) {
            console.error('Errore durante la chiusura del database:', error);
        }
    }
    reconfigureDatabase(config) {
        if (this.db) {
            this.closeDatabase();
        }
        this.initDatabase(config);
    }
    loadConfigFromDatabase() {
        if (this.isConfigured) {
            return true;
        }
        try {
            const db = this.getDatabase();
            // Verifica se la tabella app_settings esiste
            const tableExists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='app_settings'
      `).get();
            if (!tableExists) {
                console.log('Tabella app_settings non trovata, mantengo configurazione predefinita');
                return false;
            }
            // Carica la configurazione dalla tabella app_settings
            const dbConfig = db.prepare(`
        SELECT value FROM app_settings WHERE key = 'app_config'
      `).get();
            if (!dbConfig) {
                console.log('Configurazione app_config non trovata, mantengo configurazione predefinita');
                return false;
            }
            // Add type assertion to ensure dbConfig has a value property
            const dbConfigValue = dbConfig;
            const config = JSON.parse(dbConfigValue.value);
            console.log('Configurazione caricata dal database:', config);
            // Riconfigura il database con la nuova configurazione
            this.reconfigureDatabase(config);
            return true;
        }
        catch (error) {
            console.error('Errore durante il caricamento della configurazione dal database:', error);
            return false;
        }
    }
    checkConnection() {
        try {
            const db = this.getDatabase();
            console.log('Verifica connessione al database SQLite...');
            const result = db.prepare('SELECT datetime(\'now\') as now').get();
            console.log('Connessione al database SQLite riuscita:', result.now);
            return true;
        }
        catch (error) {
            console.error('Errore di connessione al database SQLite:', error);
            return false;
        }
    }
    initializeDatabase(config) {
        try {
            // If config is provided, reconfigure the database
            if (config) {
                this.reconfigureDatabase(config);
            }
            const db = this.getDatabase();
            // Verifica se la tabella app_settings esiste
            const tableExists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='app_settings'
      `).get();
            if (!tableExists) {
                console.log('Creazione tabella app_settings...');
                db.prepare(`
          CREATE TABLE app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          )
        `).run();
                // Inserisci le impostazioni di base
                const insertStmt = db.prepare(`
          INSERT INTO app_settings (key, value)
          VALUES (?, ?)
        `);
                insertStmt.run('setup_complete', JSON.stringify({ complete: false, timestamp: null }));
                insertStmt.run('app_config', JSON.stringify({}));
                console.log('Tabella app_settings creata con successo');
            }
            return true;
        }
        catch (error) {
            console.error('Errore durante l\'inizializzazione del database:', error);
            return false;
        }
    }
    getDatabaseConfig() {
        try {
            const db = this.getDatabase();
            // Verifica se la tabella app_settings esiste
            const tableExists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='app_settings'
      `).get();
            if (tableExists) {
                // Carica la configurazione dalla tabella app_settings
                const dbConfig = db.prepare(`
          SELECT value FROM app_settings WHERE key = 'app_config'
        `).get();
                if (dbConfig) {
                    // Add type assertion to ensure dbConfig has a value property
                    const dbConfigValue = dbConfig;
                    return JSON.parse(dbConfigValue.value);
                }
            }
            // Se non è stato possibile caricare dal database, restituisci configurazione predefinita
            return {
                dbPath: path_1.default.join(process.cwd(), 'data', 'slabs.db')
            };
        }
        catch (error) {
            console.error('Errore durante la lettura della configurazione del database:', error);
            return {};
        }
    }
}
// Singleton instance
const dbManager = DatabaseManager.getInstance();
// Exported functions that use the singleton
const getDatabase = () => {
    return dbManager.getDatabase();
};
exports.getDatabase = getDatabase;
const checkDatabaseConnection = () => {
    const connected = dbManager.checkConnection();
    if (connected) {
        // Try to load config from database after successful connection
        dbManager.loadConfigFromDatabase();
    }
    return connected;
};
exports.checkDatabaseConnection = checkDatabaseConnection;
const initializeDatabase = (config) => {
    return dbManager.initializeDatabase(config);
};
exports.initializeDatabase = initializeDatabase;
const getDatabaseConfig = () => {
    return dbManager.getDatabaseConfig();
};
exports.getDatabaseConfig = getDatabaseConfig;
const closeDatabase = () => {
    dbManager.closeDatabase();
};
exports.closeDatabase = closeDatabase;
