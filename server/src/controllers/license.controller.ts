import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getDatabase } from '../config/database-sqlite';

// Get the database instance
const db = getDatabase();

// Function to log messages
const logMessage = (message: string) => {
  console.log(`[License Controller] ${message}`);
};

/**
 * Get license information
 * @param req - Express request object
 * @param res - Express response object
 */
export const getLicenseInfo = (req: Request, res: Response) => {
  try {
    logMessage('Getting license information');
    
    // In a real application, this would validate against a database or license file
    // For now, we'll simulate a valid license with an expiration date
    const today = new Date();
    const expirationDate = new Date(today);
    expirationDate.setDate(today.getDate() + 45); // License expires in 45 days
    
    const daysUntilExpiry = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const isValid = daysUntilExpiry > 0;
    
    // Return license information
    res.json({
      key: 'DEMO-LICENSE-KEY',
      expirationDate: expirationDate.toISOString().split('T')[0],
      daysUntilExpiry,
      isValid,
      features: {
        whatsappIntegration: true,
        googleCalendarIntegration: true
      }
    });
  } catch (error) {
    logMessage(`Error getting license info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    res.status(500).json({ 
      error: 'Failed to retrieve license information',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Update license with a new key
 * @param req - Express request object
 * @param res - Express response object
 */
export const updateLicense = (req: Request, res: Response) => {
  try {
    const { licenseKey } = req.body;
    
    logMessage(`Updating license with key: ${licenseKey}`);
    
    if (!licenseKey) {
      return res.status(400).json({ error: 'License key is required' });
    }
    
    // In a real application, this would validate the license key against a service
    // For now, we'll simulate a successful license update
    const today = new Date();
    const expirationDate = new Date(today);
    expirationDate.setFullYear(today.getFullYear() + 1); // License valid for 1 year
    
    const daysUntilExpiry = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // Return updated license information
    res.json({
      key: licenseKey,
      expirationDate: expirationDate.toISOString().split('T')[0],
      daysUntilExpiry,
      isValid: true,
      features: {
        whatsappIntegration: true,
        googleCalendarIntegration: true
      },
      message: 'License updated successfully'
    });
  } catch (error) {
    logMessage(`Error updating license: ${error instanceof Error ? error.message : 'Unknown error'}`);
    res.status(500).json({ 
      error: 'Failed to update license',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};