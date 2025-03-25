"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testDatabaseConnection = exports.updateAppConfig = exports.getSetupStatus = exports.completeSetup = exports.checkSetupComplete = void 0;
const database_sqlite_1 = require("../config/database-sqlite");
// Check if setup is complete
const checkSetupComplete = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const db = (0, database_sqlite_1.getDatabase)();
        // Verifica se la tabella app_settings esiste
        const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='app_settings'
    `).get();
        if (!tableExists) {
            return res.json({ complete: false });
        }
        // Verifica se setup_complete esiste
        const setupComplete = db.prepare(`
      SELECT value FROM app_settings WHERE key = 'setup_complete'
    `).get();
        if (!setupComplete) {
            return res.json({ complete: false });
        }
        const setupValue = JSON.parse(setupComplete.value);
        return res.json({
            complete: setupValue.complete,
            timestamp: setupValue.timestamp
        });
    }
    catch (error) {
        console.error('Error checking setup status:', error);
        return res.status(500).json({
            message: 'Error checking setup status',
            error: error.message
        });
    }
});
exports.checkSetupComplete = checkSetupComplete;
// Complete setup
const completeSetup = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const db = (0, database_sqlite_1.getDatabase)();
        // Verifica se la tabella app_settings esiste
        const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='app_settings'
    `).get();
        if (!tableExists) {
            // Crea la tabella app_settings
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
        }
        // Aggiorna setup_complete
        const timestamp = new Date().toISOString();
        const updateStmt = db.prepare(`
      UPDATE app_settings SET
        value = ?,
        updated_at = datetime('now')
      WHERE key = 'setup_complete'
    `);
        updateStmt.run(JSON.stringify({ complete: true, timestamp }));
        return res.json({
            complete: true,
            timestamp
        });
    }
    catch (error) {
        console.error('Error completing setup:', error);
        return res.status(500).json({
            message: 'Error completing setup',
            error: error.message
        });
    }
});
exports.completeSetup = completeSetup;
const getSetupStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const db = (0, database_sqlite_1.getDatabase)();
        // Verifica se la tabella app_settings esiste
        const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='app_settings'
    `).get();
        if (!tableExists) {
            return res.json({
                setup_complete: false,
                database_connection: true,
                migrations_complete: false
            });
        }
        // Verifica se setup_complete esiste
        const setupComplete = db.prepare(`
      SELECT * FROM app_settings WHERE key = 'setup_complete'
    `).get();
        const setupValue = setupComplete ? JSON.parse(setupComplete.value) : { complete: false };
        return res.json({
            setup_complete: setupValue.complete,
            database_connection: true,
            migrations_complete: true
        });
    }
    catch (error) {
        console.error('Error getting setup status:', error);
        return res.status(500).json({
            message: 'Error getting setup status',
            error: error.message
        });
    }
});
exports.getSetupStatus = getSetupStatus;
// Update app configuration
const updateAppConfig = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const config = req.body;
        if (!config) {
            return res.status(400).json({
                message: 'Configuration data is required'
            });
        }
        const db = (0, database_sqlite_1.getDatabase)();
        // Verifica se la tabella app_settings esiste
        const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='app_settings'
    `).get();
        if (!tableExists) {
            // Crea la tabella app_settings
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
            insertStmt.run('app_config', JSON.stringify(config));
        }
        else {
            // Aggiorna app_config
            const updateStmt = db.prepare(`
        UPDATE app_settings SET
          value = ?,
          updated_at = datetime('now')
        WHERE key = 'app_config'
      `);
            updateStmt.run(JSON.stringify(config));
        }
        return res.json({
            message: 'Configuration updated successfully',
            config
        });
    }
    catch (error) {
        console.error('Error updating app configuration:', error);
        return res.status(500).json({
            message: 'Error updating app configuration',
            error: error.message
        });
    }
});
exports.updateAppConfig = updateAppConfig;
// Test database connection
const testDatabaseConnection = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const db = (0, database_sqlite_1.getDatabase)();
        // Try to execute a simple query to verify connection
        db.prepare('SELECT 1').get();
        return res.json({
            connected: true,
            message: 'Database connection successful'
        });
    }
    catch (error) {
        console.error('Error testing database connection:', error);
        return res.status(500).json({
            connected: false,
            message: 'Database connection failed',
            error: error.message
        });
    }
});
exports.testDatabaseConnection = testDatabaseConnection;
