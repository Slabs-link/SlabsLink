import { Request, Response } from 'express';
import { getDatabase } from '../config/database-sqlite';
import { backupService } from '../services/backup.service';
import { appSettings } from '../config/app-settings';

// Interface for auto backup settings
interface AutoBackupSettings {
  enabled: boolean;
  frequency: number; // in hours
  maxBackups: number;
}

// Get auto backup settings
export const getAutoBackupSettings = async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    
    // Verifica se la tabella app_settings esiste
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='app_settings'
    `).get();
    
    if (!tableExists) {
      return res.json(getDefaultSettings());
    }
    
    const setting = db.prepare('SELECT * FROM app_settings WHERE key = ?').get('auto-backup') as any;
    
    if (!setting) {
      return res.json(getDefaultSettings());
    }
    
    // Converti il valore JSON in oggetto JavaScript
    let value;
    try {
      value = JSON.parse(setting.value);
    } catch (error) {
      value = getDefaultSettings();
    }
    
    return res.json(value);
  } catch (error: any) {
    console.error('Error getting auto backup settings:', error);
    return res.status(500).json({ 
      message: 'Error retrieving auto backup settings', 
      error: error.message 
    });
  }
};

// Update auto backup settings
export const updateAutoBackupSettings = async (req: Request, res: Response) => {
  try {
    const settings: AutoBackupSettings = req.body;
    
    // Validazione dei dati
    if (settings.frequency === undefined || settings.maxBackups === undefined || settings.enabled === undefined) {
      return res.status(400).json({
        message: 'Dati incompleti. Sono richiesti enabled, frequency e maxBackups'
      });
    }
    
    // Converti i valori in tipi corretti
    const validatedSettings: AutoBackupSettings = {
      enabled: Boolean(settings.enabled),
      frequency: Number(settings.frequency),
      maxBackups: Number(settings.maxBackups)
    };
    
    // Validazione dei valori numerici
    if (isNaN(validatedSettings.frequency) || validatedSettings.frequency < 1) {
      return res.status(400).json({
        message: 'La frequenza deve essere un numero maggiore di 0'
      });
    }
    
    if (isNaN(validatedSettings.maxBackups) || validatedSettings.maxBackups < 1) {
      return res.status(400).json({
        message: 'Il numero massimo di backup deve essere un numero maggiore di 0'
      });
    }
    
    const db = getDatabase();
    
    // Verifica se la tabella app_settings esiste
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='app_settings'
    `).get();
    
    if (!tableExists) {
      // Crea la tabella app_settings se non esiste
      db.prepare(`
        CREATE TABLE app_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT UNIQUE,
          value TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
    }
    
    // Verifica se l'impostazione esiste già
    const existingSetting = db.prepare('SELECT * FROM app_settings WHERE key = ?').get('auto-backup');
    
    const jsonValue = JSON.stringify(validatedSettings);
    
    if (existingSetting) {
      // Aggiorna l'impostazione esistente
      db.prepare(`
        UPDATE app_settings SET
        value = ?,
        updated_at = CURRENT_TIMESTAMP
        WHERE key = ?
      `).run(jsonValue, 'auto-backup');
    } else {
      // Inserisci una nuova impostazione
      db.prepare(`
        INSERT INTO app_settings (key, value)
        VALUES (?, ?)
      `).run('auto-backup', jsonValue);
    }
    
    // Aggiorna il servizio di backup con le nuove impostazioni
    if (backupService.setMaxBackups) {
      backupService.setMaxBackups(validatedSettings.maxBackups);
    }
    
    // Salva le impostazioni nel sistema di configurazione
// Remove duplicate db declaration since it's already defined above
    await appSettings.set('backupEnabled', validatedSettings.enabled);
    await appSettings.set('maxBackups', validatedSettings.maxBackups);
    await appSettings.set('backupFrequencyHours', validatedSettings.frequency);
    
    // Nota: alcune modifiche potrebbero richiedere un riavvio del server 
    // per avere effetto completo sul timer di backup
    
    return res.json({
      message: 'Impostazioni di backup automatico aggiornate con successo',
      settings: validatedSettings
    });
  } catch (error: any) {
    console.error('Error updating auto backup settings:', error);
    return res.status(500).json({ 
      message: 'Error updating auto backup settings', 
      error: error.message 
    });
  }
};

// Default settings
const getDefaultSettings = (): AutoBackupSettings => {
  return {
    enabled: false,
    frequency: 24, // 24 ore (giornaliero)
    maxBackups: 10
  };
};