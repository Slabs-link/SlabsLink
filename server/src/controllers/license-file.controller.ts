import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../config/database-sqlite';
import multer from 'multer';

// Extend Express Request interface to include file property from multer
declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File;
    }
  }
}

// Interface for license file data
interface LicenseFile {
  key: string;
  expirationDate: string;
  features: {
    whatsappIntegration: boolean;
    googleCalendarIntegration: boolean;
  };
}

/**
 * Load and validate a license file
 */
export const loadLicenseFile = async (req: Request, res: Response) => {
  try {
    // Check if a file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Nessun file caricato'
      });
    }

    // Read the file content
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    
    // Try to parse the JSON
    let licenseData: LicenseFile;
    try {
      licenseData = JSON.parse(fileContent);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Il file selezionato non è un file JSON valido'
      });
    }
    
    // Validate the license data structure
    if (!licenseData.key || typeof licenseData.key !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Il file della licenza non contiene una chiave valida'
      });
    }
    
    if (!licenseData.expirationDate || typeof licenseData.expirationDate !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Il file della licenza non contiene una data di scadenza valida'
      });
    }
    
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(licenseData.expirationDate)) {
      return res.status(400).json({
        success: false,
        message: 'Il formato della data di scadenza non è valido. Utilizzare il formato YYYY-MM-DD'
      });
    }
    
    // Validate features
    if (!licenseData.features || typeof licenseData.features !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Il file della licenza non contiene informazioni valide sulle funzionalità'
      });
    }
    
    // Check if whatsappIntegration and googleCalendarIntegration are defined
    if (typeof licenseData.features.whatsappIntegration !== 'boolean' || 
        typeof licenseData.features.googleCalendarIntegration !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Le funzionalità della licenza non sono definite correttamente'
      });
    }
    
    // If we get here, the license file is valid
    // Now we can save it to the database
    const db = getDatabase();
    
    // Verify if the licenses table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='licenses'
    `).get();
    
    if (!tableExists) {
      // Create the licenses table if it doesn't exist
      db.prepare(`
        CREATE TABLE licenses (
          id TEXT PRIMARY KEY,
          key TEXT UNIQUE NOT NULL,
          expiration_date TEXT NOT NULL,
          features TEXT NOT NULL,
          active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )
      `).run();
    }
    
    // Begin transaction
    db.prepare('BEGIN TRANSACTION').run();
    
    try {
      // Deactivate all existing licenses
      db.prepare(`
        UPDATE licenses SET
          active = 0,
          updated_at = datetime('now')
      `).run();
      
      // Check if license already exists
      const existingLicense = db.prepare('SELECT id FROM licenses WHERE key = ?').get(licenseData.key);
      
      if (existingLicense) {
        // Update existing license
        db.prepare(`
          UPDATE licenses SET
            expiration_date = ?,
            features = ?,
            active = 1,
            updated_at = datetime('now')
          WHERE key = ?
        `).run(
          licenseData.expirationDate, 
          JSON.stringify(licenseData.features), 
          licenseData.key
        );
      } else {
        // Insert new license
        db.prepare(`
          INSERT INTO licenses (id, key, expiration_date, features, active)
          VALUES (?, ?, ?, ?, 1)
        `).run(
          uuidv4(), 
          licenseData.key, 
          licenseData.expirationDate, 
          JSON.stringify(licenseData.features)
        );
      }
      
      // Commit transaction
      db.prepare('COMMIT').run();
      
      // Get the updated license
      const updatedLicense = db.prepare('SELECT * FROM licenses WHERE key = ?').get(licenseData.key) as any;
      
      // Parse features from JSON string
      const updatedFeatures = JSON.parse(updatedLicense.features);
      
      // Calculate days until expiry
      const updatedExpirationDate = new Date(updatedLicense.expiration_date);
      const today = new Date();
      const daysUntilExpiry = Math.ceil((updatedExpirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      // Delete the temporary file
      fs.unlinkSync(req.file.path);
      
      return res.json({
        success: true,
        message: 'Licenza caricata con successo',
        license: {
          key: updatedLicense.key,
          expirationDate: updatedLicense.expiration_date,
          daysUntilExpiry,
          isValid: daysUntilExpiry > 0,
          features: updatedFeatures
        }
      });
    } catch (error) {
      // Rollback transaction in case of error
      db.prepare('ROLLBACK').run();
      throw error;
    }
  } catch (error: any) {
    console.error('Error loading license file:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Errore durante il caricamento del file della licenza', 
      error: error.message
    });
  }
};