import { Request, Response } from 'express';
import { getDatabase } from '../config/database-sqlite';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Interface for license data
interface License {
  id: string;
  key: string;
  expirationDate: string;
  features: {
    whatsappIntegration: boolean;
    googleCalendarIntegration: boolean;
  };
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Get current license information
export const getLicenseInfo = async (req: Request, res: Response) => {
  try {
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
      
      return res.status(404).json({ 
        message: 'No license found',
        isValid: false
      });
    }
    
    // Get the active license
    const license = db.prepare(`
      SELECT * FROM licenses 
      WHERE active = 1 
      ORDER BY created_at DESC 
      LIMIT 1
    `).get() as any;
    
    if (!license) {
      return res.status(404).json({ 
        message: 'No active license found',
        isValid: false
      });
    }
    
    // Parse features from JSON string
    const features = JSON.parse(license.features);
    
    // Calculate days until expiry
    const expirationDate = new Date(license.expiration_date);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // Check if license is valid
    const isValid = daysUntilExpiry > 0;
    
    return res.json({
      key: license.key,
      expirationDate: license.expiration_date,
      daysUntilExpiry,
      isValid,
      features
    });
  } catch (error: any) {
    console.error('Error getting license info:', error);
    return res.status(500).json({ 
      message: 'Error retrieving license information', 
      error: error.message,
      isValid: false
    });
  }
};

// Update license
export const updateLicense = async (req: Request, res: Response) => {
  try {
    console.log('License update endpoint called with body:', req.body);
    const { licenseKey, expirationDate, features } = req.body;
    
    if (!licenseKey) {
      return res.status(400).json({ 
        message: 'License key is required',
        success: false
      });
    }
    
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
      
      // Prepare features object
      let featuresObj = {
        whatsappIntegration: false,
        googleCalendarIntegration: false
      };
      
      // If features are provided, use them
      if (features) {
        featuresObj = {
          ...featuresObj,
          ...features
        };
      }
      
      // Determine expiration date
      let expDate = expirationDate;
      if (!expDate) {
        // Default to 1 year from now if not provided
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
        expDate = oneYearFromNow.toISOString().split('T')[0];
      }
      
      // Check if license already exists
      const existingLicense = db.prepare('SELECT id FROM licenses WHERE key = ?').get(licenseKey);
      
      if (existingLicense) {
        // Update existing license
        db.prepare(`
          UPDATE licenses SET
            expiration_date = ?,
            features = ?,
            active = 1,
            updated_at = datetime('now')
          WHERE key = ?
        `).run(expDate, JSON.stringify(featuresObj), licenseKey);
      } else {
        // Insert new license
        db.prepare(`
          INSERT INTO licenses (id, key, expiration_date, features, active)
          VALUES (?, ?, ?, ?, 1)
        `).run(uuidv4(), licenseKey, expDate, JSON.stringify(featuresObj));
      }
      
      // Commit transaction
      db.prepare('COMMIT').run();
      
      // Get the updated license
      const updatedLicense = db.prepare('SELECT * FROM licenses WHERE key = ?').get(licenseKey) as any;
      
      // Parse features from JSON string
      const updatedFeatures = JSON.parse(updatedLicense.features);
      
      // Calculate days until expiry
      const updatedExpirationDate = new Date(updatedLicense.expiration_date);
      const today = new Date();
      const daysUntilExpiry = Math.ceil((updatedExpirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      return res.json({
        success: true,
        message: 'License updated successfully',
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
    console.error('Error updating license:', error);
    return res.status(500).json({ 
      message: 'Error updating license', 
      error: error.message,
      success: false
    });
  }
};