import { Request, Response } from 'express';
import { getDatabase } from '../config/database-sqlite';

// Get the database instance
const db = getDatabase();

// Function to log messages
const logMessage = (message: string) => {
  console.log(`[Settings Controller] ${message}`);
};

/**
 * Get all settings
 * @param req - Express request object
 * @param res - Express response object
 */
export const getSettings = (req: Request, res: Response) => {
  try {
    logMessage('Getting all settings');
    
    // In a real application, this would fetch settings from a database
    // For now, we'll return mock settings
    res.json({
      general: {
        clinicName: 'SlabsLink Clinic',
        address: 'Via Roma 123, Milano',
        phone: '+39 02 1234567',
        email: 'info@slabslink.com',
        website: 'www.slabslink.com'
      },
      whatsapp: {
        enabled: true,
        browserPath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        dataPath: 'C:\\WhatsAppData',
        autoReply: true,
        autoReplyMessage: 'Grazie per il tuo messaggio. Ti risponderemo al più presto.'
      },
      calendar: {
        googleCalendarEnabled: true,
        clientId: 'your-client-id.apps.googleusercontent.com',
        clientSecret: 'your-client-secret',
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
      },
      notifications: {
        appointmentReminders: true,
        reminderTime: 24,
        reminderMessage: 'Promemoria: hai un appuntamento domani alle {time}.',
        followUpMessages: true,
        followUpTime: 24,
        followUpMessage: 'Grazie per la tua visita. Come ti senti dopo l\'appuntamento?'
      }
    });
  } catch (error) {
    logMessage(`Error getting settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    res.status(500).json({ 
      error: 'Failed to retrieve settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Update settings
 * @param req - Express request object
 * @param res - Express response object
 */
export const updateSettings = (req: Request, res: Response) => {
  try {
    const settings = req.body;
    
    logMessage(`Updating settings: ${JSON.stringify(settings)}`);
    
    if (!settings) {
      return res.status(400).json({ error: 'Settings data is required' });
    }
    
    // In a real application, this would update settings in a database
    // For now, we'll just return the received settings
    res.json({
      ...settings,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    logMessage(`Error updating settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    res.status(500).json({ 
      error: 'Failed to update settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
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