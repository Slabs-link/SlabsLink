import { Request, Response } from 'express';
import { getDatabase } from '../config/database-sqlite';

// Interface for app settings
interface AppSetting {
  key: string;
  value: string;
  created_at?: string;
  updated_at?: string;
}

// Get all settings
export const getAllSettings = async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    
    // Verifica se la tabella app_settings esiste
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='app_settings'
    `).get();
    
    if (!tableExists) {
      return res.json({});
    }
    
    const settings = db.prepare('SELECT * FROM app_settings').all() as AppSetting[];
    
    // Converti i valori JSON in oggetti JavaScript
    const formattedSettings: Record<string, any> = {};
    for (const setting of settings) {
      try {
        formattedSettings[setting.key] = JSON.parse(setting.value);
      } catch (error) {
        formattedSettings[setting.key] = setting.value;
      }
    }
    
    return res.json(formattedSettings);
  } catch (error: any) {
    console.error('Error getting settings:', error);
    return res.status(500).json({ 
      message: 'Error retrieving settings', 
      error: error.message 
    });
  }
};

// Get general settings
export const getGeneralSettings = (req: Request, res: Response) => {
  try {
    const db = getDatabase(); // Add this line
    const settings = db.prepare('SELECT * FROM app_settings WHERE key = \'general\'').get();
    if (settings) {
      console.log('[Backend] Fetched General Settings from DB:', settings); // Log aggiunto
      res.json(settings);
    } else {
      // Se non ci sono impostazioni, restituisci valori predefiniti o un oggetto vuoto
      console.log('[Backend] No General Settings found in DB, returning defaults.'); // Log aggiunto
      res.json({ clinicName: '', address: '', phone: '', email: '', website: '' });
    }
  } catch (error) {
    console.error('Error fetching general settings:', error);
    res.status(500).json({ message: 'Error fetching general settings' });
  }
};

// Get whatsapp settings
export const getWhatsappSettings = async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    
    // Verifica se la tabella app_settings esiste
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='app_settings'
    `).get();
    
    if (!tableExists) {
      return res.json({ whatsapp: {
        enabled: false,
        browserPath: '',
        dataPath: '',
        autoReply: false,
        autoReplyMessage: ''
      }});
    }
    
    const setting = db.prepare('SELECT * FROM app_settings WHERE key = ?').get('whatsapp') as AppSetting | undefined;
    
    if (!setting) {
      return res.json({ whatsapp: {
        enabled: false,
        browserPath: '',
        dataPath: '',
        autoReply: false,
        autoReplyMessage: ''
      }});
    }
    
    // Converti il valore JSON in oggetto JavaScript
    let value;
    try {
      value = JSON.parse(setting.value);
    } catch (error) {
      value = {
        enabled: false,
        browserPath: '',
        dataPath: '',
        autoReply: false,
        autoReplyMessage: ''
      };
    }
    
    return res.json({ whatsapp: value });
  } catch (error: any) {
    console.error('Error getting whatsapp settings:', error);
    return res.status(500).json({ 
      message: 'Error retrieving whatsapp settings', 
      error: error.message 
    });
  }
};

// Get calendar settings
export const getCalendarSettings = async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    
    // Verifica se la tabella app_settings esiste
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='app_settings'
    `).get();
    
    if (!tableExists) {
      return res.json({ calendar: {
        googleCalendarEnabled: false,
        clientId: '',
        clientSecret: '',
        redirectUri: 'http://localhost:3000/auth/google/callback',
        workingHours: {
          mondayStart: '09:00',
          mondayEnd: '18:00',
          tuesdayStart: '09:00',
          tuesdayEnd: '18:00',
          wednesdayStart: '09:00',
          wednesdayEnd: '18:00',
          thursdayStart: '09:00',
          thursdayEnd: '18:00',
          fridayStart: '09:00',
          fridayEnd: '18:00',
          saturdayStart: '',
          saturdayEnd: '',
          sundayStart: '',
          sundayEnd: ''
        }
      }});
    }
    
    const setting = db.prepare('SELECT * FROM app_settings WHERE key = ?').get('calendar') as AppSetting | undefined;
    
    if (!setting) {
      return res.json({ calendar: {
        googleCalendarEnabled: false,
        clientId: '',
        clientSecret: '',
        redirectUri: 'http://localhost:3000/auth/google/callback',
        workingHours: {
          mondayStart: '09:00',
          mondayEnd: '18:00',
          tuesdayStart: '09:00',
          tuesdayEnd: '18:00',
          wednesdayStart: '09:00',
          wednesdayEnd: '18:00',
          thursdayStart: '09:00',
          thursdayEnd: '18:00',
          fridayStart: '09:00',
          fridayEnd: '18:00',
          saturdayStart: '',
          saturdayEnd: '',
          sundayStart: '',
          sundayEnd: ''
        }
      }});
    }
    
    // Converti il valore JSON in oggetto JavaScript
    let value;
    try {
      value = JSON.parse(setting.value);
    } catch (error) {
      value = {
        googleCalendarEnabled: false,
        clientId: '',
        clientSecret: '',
        redirectUri: 'http://localhost:3000/auth/google/callback',
        workingHours: {
          mondayStart: '09:00',
          mondayEnd: '18:00',
          tuesdayStart: '09:00',
          tuesdayEnd: '18:00',
          wednesdayStart: '09:00',
          wednesdayEnd: '18:00',
          thursdayStart: '09:00',
          thursdayEnd: '18:00',
          fridayStart: '09:00',
          fridayEnd: '18:00',
          saturdayStart: '',
          saturdayEnd: '',
          sundayStart: '',
          sundayEnd: ''
        }
      };
    }
    
    return res.json({ calendar: value });
  } catch (error: any) {
    console.error('Error getting calendar settings:', error);
    return res.status(500).json({ 
      message: 'Error retrieving calendar settings', 
      error: error.message 
    });
  }
};

// Get setting by key
export const getSettingByKey = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const db = getDatabase();
    
    // Verifica se la tabella app_settings esiste
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='app_settings'
    `).get();
    
    if (!tableExists) {
      return res.status(404).json({ message: 'Settings table not found' });
    }
    
    const setting = db.prepare('SELECT * FROM app_settings WHERE key = ?').get(key) as AppSetting | undefined;
    
    if (!setting) {
      return res.status(404).json({ message: 'Setting not found' });
    }
    
    // Converti il valore JSON in oggetto JavaScript
    let value;
    try {
      value = JSON.parse(setting.value);
    } catch (error) {
      value = setting.value;
    }
    
    return res.json({ [key]: value });
  } catch (error: any) {
    console.error('Error getting setting:', error);
    return res.status(500).json({ 
      message: 'Error retrieving setting', 
      error: error.message 
    });
  }
};

// Update setting
export const updateSetting = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const value = req.body;
    
    if (!value) {
      return res.status(400).json({ 
        message: 'Value is required' 
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
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )
      `).run();
    }
    
    // Verifica se la chiave esiste già
    const settingExists = db.prepare('SELECT key FROM app_settings WHERE key = ?').get(key);
    
    // Converti il valore in JSON
    const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
    
    if (settingExists) {
      // Aggiorna il valore
      const updateStmt = db.prepare(`
        UPDATE app_settings SET
          value = ?,
          updated_at = datetime('now')
        WHERE key = ?
      `);
      
      updateStmt.run(jsonValue, key);
    } else {
      // Inserisci un nuovo valore
      const insertStmt = db.prepare(`
        INSERT INTO app_settings (key, value)
        VALUES (?, ?)
      `);
      
      insertStmt.run(key, jsonValue);
    }
    
    // Ottieni il valore aggiornato
    const updatedSetting = db.prepare('SELECT * FROM app_settings WHERE key = ?').get(key) as AppSetting;
    
    // Converti il valore JSON in oggetto JavaScript
    let updatedValue;
    try {
      updatedValue = JSON.parse(updatedSetting.value);
    } catch (error) {
      updatedValue = updatedSetting.value;
    }
    
    return res.json({ 
      message: 'Setting updated successfully',
      [key]: updatedValue
    });
  } catch (error: any) {
    console.error('Error updating setting:', error);
    return res.status(500).json({ 
      message: 'Error updating setting', 
      error: error.message 
    });
  }
};

// Delete setting
export const deleteSetting = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const db = getDatabase();
    
    // Verifica se la tabella app_settings esiste
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='app_settings'
    `).get();
    
    if (!tableExists) {
      return res.status(404).json({ message: 'Settings table not found' });
    }
    
    // Verifica se la chiave esiste
    const settingExists = db.prepare('SELECT key FROM app_settings WHERE key = ?').get(key);
    
    if (!settingExists) {
      return res.status(404).json({ message: 'Setting not found' });
    }
    
    // Elimina l'impostazione
    const deleteStmt = db.prepare('DELETE FROM app_settings WHERE key = ?');
    deleteStmt.run(key);
    
    return res.json({ 
      message: 'Setting deleted successfully',
      key
    });
  } catch (error: any) {
    console.error('Error deleting setting:', error);
    return res.status(500).json({ 
      message: 'Error deleting setting', 
      error: error.message 
    });
  }
};