import { Request, Response } from 'express';
import { getDatabase } from '../config/database-sqlite';

// Interface for medical office settings
interface MedicalOfficeSettings {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  vatNumber: string;
  fiscalCode: string;
  specialization: string;
  logo: string;
  useLetterhead: boolean;
  letterheadTemplate: string;
  defaultAppointmentDuration: number;
  showInfoTab: boolean;
  enableUserFileUpload: boolean;
  userFilesPath: string;
}

// Get medical office settings
export const getMedicalOfficeSettings = async (req: Request, res: Response) => {
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
    
    const setting = db.prepare('SELECT * FROM app_settings WHERE key = ?').get('medical-office') as any;
    
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
    console.error('Error getting medical office settings:', error);
    return res.status(500).json({ 
      message: 'Error retrieving medical office settings', 
      error: error.message 
    });
  }
};

// Update medical office settings
export const updateMedicalOfficeSettings = async (req: Request, res: Response) => {
  try {
    // Ottieni i dati dal form
    const formData = req.body;
    
    // Converti i valori booleani da stringa a booleano
    const settings: any = {};
    
    // Processa i dati del form per convertire i tipi corretti
    Object.keys(formData).forEach(key => {
      // Converti stringhe 'true'/'false' in booleani
      if (formData[key] === 'true' || formData[key] === 'false') {
        settings[key] = formData[key] === 'true';
      } else if (typeof formData[key] === 'string' && (formData[key].toLowerCase() === 'true' || formData[key].toLowerCase() === 'false')) {
        // Gestisce anche le varianti maiuscole/minuscole di true/false
        settings[key] = formData[key].toLowerCase() === 'true';
      } else {
        settings[key] = formData[key];
      }
    });
    
    // Verifica che ci siano dati da salvare
    if (Object.keys(settings).length === 0) {
      return res.status(400).json({
        message: 'Nessun dato valido fornito per l\'aggiornamento delle impostazioni'
      });
    }
    
    console.log('Impostazioni processate:', settings);
    
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
    const settingExists = db.prepare('SELECT key FROM app_settings WHERE key = ?').get('medical-office');
    
    // Converti il valore in JSON
    const jsonValue = JSON.stringify(settings);
    
    if (settingExists) {
      // Aggiorna il valore
      const updateStmt = db.prepare(`
        UPDATE app_settings SET
          value = ?,
          updated_at = datetime('now')
        WHERE key = ?
      `);
      
      updateStmt.run(jsonValue, 'medical-office');
    } else {
      // Inserisci un nuovo valore
      const insertStmt = db.prepare(`
        INSERT INTO app_settings (key, value)
        VALUES (?, ?)
      `);
      
      insertStmt.run('medical-office', jsonValue);
    }
    
    return res.json({ 
      message: 'Medical office settings updated successfully',
      settings
    });
  } catch (error: any) {
    console.error('Error updating medical office settings:', error);
    return res.status(500).json({ 
      message: 'Error updating medical office settings', 
      error: error.message 
    });
  }
};

// Funzione per ottenere le impostazioni predefinite
const getDefaultSettings = (): MedicalOfficeSettings => {
  return {
    name: '',
    address: '',
    city: '',
    postalCode: '',
    phone: '',
    email: '',
    website: '',
    vatNumber: '',
    fiscalCode: '',
    specialization: '',
    logo: '',
    useLetterhead: false,
    letterheadTemplate: 'default',
    defaultAppointmentDuration: 30,
    showInfoTab: true,
    enableUserFileUpload: false,
    userFilesPath: 'uploads/users'
  };
};