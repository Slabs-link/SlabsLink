import { Request, Response } from 'express';
import { getDatabase } from '../config/database-sqlite';

// Check if setup is complete
export const checkSetupComplete = async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    
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
    `).get() as AppSetting | undefined;
    
    if (!setupComplete) {
      return res.json({ complete: false });
    }
    
    const setupValue = JSON.parse(setupComplete.value);
    
    return res.json({ 
      setup_complete: setupValue.complete,
      timestamp: setupValue.timestamp
    });
  } catch (error: any) {
    console.error('Error checking setup status:', error);
    return res.status(500).json({ 
      message: 'Error checking setup status', 
      error: error.message 
    });
  }
};

// Complete setup
export const completeSetup = async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    
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
      
      insertStmt.run('setup_complete', JSON.stringify({complete: false, timestamp: null}));
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
    
    updateStmt.run(JSON.stringify({complete: true, timestamp}));
    
    return res.json({ 
      complete: true,
      timestamp
    });
  } catch (error: any) {
    console.error('Error completing setup:', error);
    return res.status(500).json({ 
      message: 'Error completing setup', 
      error: error.message 
    });
  }
};

// Get setup status
// Define interface for app settings
interface AppSetting {
  key: string;
  value: string;
}

export const getSetupStatus = async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    
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
    `).get() as AppSetting | undefined;
    
    // Assicuriamoci che setupComplete esista e che il valore sia correttamente analizzato
    let setupValue = { complete: false };
    if (setupComplete && setupComplete.value) {
      try {
        setupValue = JSON.parse(setupComplete.value);
      } catch (parseError) {
        console.error('Error parsing setup_complete value:', parseError);
      }
    }
    
    console.log('Setup status value:', setupValue);
    
    return res.json({
      setup_complete: setupValue.complete === true,
      database_connection: true,
      migrations_complete: true
    });
  } catch (error: any) {
    console.error('Error getting setup status:', error);
    return res.status(500).json({ 
      message: 'Error getting setup status', 
      error: error.message 
    });
  }
};

// Update app configuration
export const updateAppConfig = async (req: Request, res: Response) => {
  try {
    const config = req.body;
    
    if (!config) {
      return res.status(400).json({ 
        message: 'Configuration data is required' 
      });
    }
    
    const db = getDatabase();
    
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
      
      insertStmt.run('setup_complete', JSON.stringify({complete: false, timestamp: null}));
      insertStmt.run('app_config', JSON.stringify(config));
    } else {
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
  } catch (error: any) {
    console.error('Error updating app configuration:', error);
    return res.status(500).json({ 
      message: 'Error updating app configuration', 
      error: error.message 
    });
  }
};

// Test database connection
export const testDatabaseConnection = async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    
    // Try to execute a simple query to verify connection
    db.prepare('SELECT 1').get();
    
    return res.json({
      connected: true,
      message: 'Database connection successful'
    });
  } catch (error: any) {
    console.error('Error testing database connection:', error);
    return res.status(500).json({
      connected: false,
      message: 'Database connection failed',
      error: error.message
    });
  }
};