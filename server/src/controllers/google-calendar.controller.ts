import { Request, Response } from 'express';
import { GoogleCalendarService } from '../services/google-calendar.service';
import { getDatabase } from '../config/database-sqlite';
import { v4 as uuidv4 } from 'uuid';

// Istanza del servizio Google Calendar
const googleCalendarService = new GoogleCalendarService();

// Function to log messages
const logMessage = (message: string) => {
  console.log(`[Google Calendar Controller] ${message}`);
};

/**
 * Ottiene l'URL di autenticazione per Google Calendar
 * @param req - Express request object
 * @param res - Express response object
 */
export const getAuthUrl = async (req: Request, res: Response) => {
  try {
    logMessage('Generating Google Calendar auth URL : ' + req.path
    );
    
    const { clientId, clientSecret, redirectUri } = req.query;
    
    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(400).json({ message: 'Parametri mancanti' });
    }
    
    // Importa dinamicamente le librerie di Google
    const { google } = await import('googleapis');
    
    // Crea un client OAuth2
    const oauth2Client = new google.auth.OAuth2(
      clientId as string,
      clientSecret as string,
      redirectUri as string
    );
    
    // Genera l'URL di autenticazione
    const scopes = ['https://www.googleapis.com/auth/calendar'];
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
    });
    
    // Controlla se la richiesta è per /auth-url o /auth
    const path = req.path;
    if (path.endsWith('/auth-url')) {
      // Restituisci l'URL come JSON
      return res.json({ authUrl });
    } else {
      // Reindirizza l'utente all'URL di autenticazione di Google
      return res.redirect(authUrl);
    }
  } catch (error) {
    logMessage(`Error generating auth URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    res.status(500).json({ 
      error: 'Failed to generate authentication URL',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Gestisce il callback di autenticazione OAuth2
 * @param req - Express request object
 * @param res - Express response object
 */
export const handleAuthCallback = async (req: Request, res: Response) => {
  try {
    logMessage('Handling OAuth callback');
    
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({ message: 'Codice di autorizzazione mancante' });
    }
    
    const db = getDatabase();
    const setting = db.prepare('SELECT * FROM app_settings WHERE key = ?').get('calendar') as { value: string };
    
    if (!setting) {
      return res.status(400).json({ message: 'Impostazioni di Google Calendar non configurate' });
    }
    
    // Converti il valore JSON in oggetto JavaScript
    let calendarSettings;
    try {
      calendarSettings = JSON.parse(setting.value?.toString() || '{}');
    } catch (error) {
      return res.status(500).json({ message: 'Errore nel parsing delle impostazioni' });
    }
    
    // Importa dinamicamente le librerie di Google
    const { google } = await import('googleapis');
    
    // Crea un client OAuth2
    const oauth2Client = new google.auth.OAuth2(
      calendarSettings.clientId,
      calendarSettings.clientSecret,
      calendarSettings.redirectUri
    );
    
    // Scambia il codice di autorizzazione con i token di accesso
    const { tokens } = await oauth2Client.getToken(code as string);
    
    // Salva i token nel database
    calendarSettings.tokens = tokens;
    
    // Aggiorna le impostazioni nel database
    db.prepare('UPDATE app_settings SET value = ? WHERE key = ?').run(
      JSON.stringify(calendarSettings),
      'calendar'
    );
    
    // Reindirizza l'utente alla pagina delle impostazioni
    res.redirect('/settings?tab=calendar&auth=success');
  } catch (error) {
    logMessage(`Error handling auth callback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    res.status(500).json({ 
      error: 'Failed to handle authentication callback',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Gestisce il webhook per le notifiche di Google Calendar
 * @param req - Express request object
 * @param res - Express response object
 */
export const handleWebhook = async (req: Request, res: Response) => {
  try {
    logMessage('Handling Google Calendar webhook');
    
    // Verifica l'intestazione X-Goog-Resource-State per determinare il tipo di evento
    const resourceState = req.headers['x-goog-resource-state'];
    const resourceId = req.headers['x-goog-resource-id'] as string;
    const channelId = req.headers['x-goog-channel-id'] as string;
    
    // Risponde immediatamente a Google per confermare la ricezione
    res.status(200).send('OK');
    
    // Processa l'evento in background
    await googleCalendarService.handleEvent(resourceId);
  } catch (error) {
    logMessage(`Error handling webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
    // Risponde comunque con 200 per evitare che Google riprovi
    res.status(200).send('OK');
  }
};

/**
 * Configura il webhook per ricevere notifiche da Google Calendar
 * @param req - Express request object
 * @param res - Express response object
 */
export const setupWebhook = async (req: Request, res: Response) => {
  try {
    logMessage('Setting up Google Calendar webhook');
    
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const channelId = await googleCalendarService.setupWebhook(baseUrl);
    
    res.json({
      message: 'Webhook configurato con successo',
      channelId
    });
  } catch (error) {
    logMessage(`Error setting up webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
    res.status(500).json({ 
      error: 'Failed to set up webhook',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Ottiene gli eventi dal calendario
 * @param req - Express request object
 * @param res - Express response object
 */
export const getCalendarEvents = async (req: Request, res: Response) => {
  try {
    logMessage('Getting calendar events');
    
    // Implementazione da completare
    // Questa funzione dovrebbe utilizzare il servizio GoogleCalendarService per ottenere gli eventi
    
    res.json({
      message: 'Funzionalità in fase di implementazione'
    });
  } catch (error) {
    logMessage(`Error getting calendar events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    res.status(500).json({ 
      error: 'Failed to get calendar events',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Sincronizza gli appuntamenti con Google Calendar
 * @param req - Express request object
 * @param res - Express response object
 */
export const syncAppointments = async (req: Request, res: Response) => {
  try {
    logMessage('Syncing appointments with Google Calendar');
    
    const appointments = await googleCalendarService.syncAppointments();
    res.json({
      message: 'Appuntamenti sincronizzati con successo',
      appointments
    });
  } catch (error) {
    logMessage(`Error syncing appointments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    res.status(500).json({ 
      error: 'Failed to sync appointments',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};