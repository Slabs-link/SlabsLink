import { Request, Response } from 'express';
import { GoogleCalendarService } from '../services/google-calendar.service';
import { GoogleCalendarWatchService } from '../services/google-calendar-watch.service';
import { getDatabase } from '../config/database-sqlite';
import { v4 as uuidv4 } from 'uuid';

// Istanza del servizio Google Calendar Watch
const googleCalendarWatchService = new GoogleCalendarWatchService();

// Istanza del servizio Google Calendar
const googleCalendarService = new GoogleCalendarService();

// Function to log messages
const logMessage = (message: string, data?: any) => {
  // Filtra i log per mostrare solo quelli importanti relativi all'autenticazione
  const isAuthRelated = message.includes('auth') || 
                        message.includes('token') || 
                        message.includes('OAuth') || 
                        message.includes('callback');
  
  // Mostra solo log importanti o relativi all'autenticazione
  if (isAuthRelated || message.includes('Error') || message.includes('errore')) {
    console.log(`[Google Calendar Controller] ${message}`, data ? data : '');
  }
};

/**
 * Genera e restituisce un link di prenotazione per Google Calendar
 * @param req - Express request object
 * @param res - Express response object
 */
export const getBookingLink = async (req: Request, res: Response) => {
  try {
    logMessage('Generazione link di prenotazione per Google Calendar');
    
    // Genera il link di prenotazione
    const bookingLink = await googleCalendarWatchService.generateBookingLink();
    
    return res.json({ 
      success: true, 
      bookingLink: bookingLink,
      message: 'Link di prenotazione generato con successo'
    });
  } catch (error) {
    logMessage(`Errore durante la generazione del link di prenotazione: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return res.status(500).json({ 
      success: false, 
      error: 'Impossibile generare il link di prenotazione',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Ottiene l'URL di autenticazione per Google Calendar
 * @param req - Express request object
 * @param res - Express response object
 */
export const getAuthUrl = async (req: Request, res: Response) => {
  try {
    logMessage('Generating Google Calendar auth URL : ' + req.path);
    
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
      prompt: 'consent' // Forza la richiesta di consenso e il rilascio di un nuovo refresh token
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
  console.log('[CALLBACK] Handling OAuth callback - callback effettuato');
  try {
    logMessage('Handling OAuth callback');
    
    const { code } = req.query;
    
    if (!code) {
      logMessage('Codice di autorizzazione mancante nella richiesta');
      return res.status(400).json({ message: 'Codice di autorizzazione mancante' });
    }
    
    logMessage(`Codice di autorizzazione ricevuto: ${code.toString().substring(0, 10)}...`);
    
    try {
      // Utilizziamo il metodo setAuthCode del servizio per gestire l'intero processo
      await googleCalendarService.setAuthCode(code.toString());
      
      logMessage('Token OAuth2 ottenuti e salvati con successo tramite il servizio');
      
      // Verifica che i token siano stati effettivamente salvati
      const db = getDatabase();
      if (!db) {
        throw new Error('Impossibile ottenere la connessione al database');
      }
      
      const verifySettings = db.prepare('SELECT * FROM app_settings WHERE key = ?').get('calendar') as { value: string } | undefined;
      
      if (!verifySettings || !verifySettings.value) {
        throw new Error('Impossibile verificare i token salvati: impostazioni non trovate o valore vuoto');
      }
      
      try {
        const verifiedCalendarSettings = JSON.parse(verifySettings.value);
        if (!verifiedCalendarSettings.tokens || !verifiedCalendarSettings.tokens.access_token) {
          throw new Error('I token salvati non sono presenti o sono incompleti');
        }
        
        logMessage('Verifica dei token salvati completata con successo');
      } catch (parseError) {
        throw new Error(`Errore nel parsing delle impostazioni durante la verifica: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }
      
      // Inizializza il servizio Google Calendar con i nuovi token
      logMessage('Inizializzazione del servizio Google Calendar');
      await googleCalendarService.configure();
      const isAuthenticated = await googleCalendarService.isServiceAuthenticated();
      
      if (!isAuthenticated) {
        throw new Error('Il servizio Google Calendar non risulta autenticato dopo il salvataggio dei token');
      }
      
      logMessage('Autenticazione completata con successo, invio risposta JSON');
      // Invece di reindirizzare, restituisci un JSON
      return res.json({ success: true, message: 'Autenticazione completata con successo' });
    } catch (authError) {
      const errorMessage = authError instanceof Error ? authError.message : 'Errore sconosciuto durante l\'autenticazione';
      logMessage(`Errore durante l'autenticazione: ${errorMessage}`);
      // Invece di reindirizzare, restituisci un JSON con l'errore
      return res.status(400).json({ success: false, message: errorMessage });
    }
  } catch (error) {
    logMessage(`Error handling auth callback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return res.status(500).json({ 
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
    
    const results = await googleCalendarService.syncAppointments();
    logMessage(`Sync completed with ${results.filter(r => r.success).length} successful and ${results.filter(r => !r.success).length} failed operations`);
    
    res.json({
      message: 'Appuntamenti sincronizzati con successo',
      results
    });
  } catch (error) {
    logMessage(`Error syncing appointments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    res.status(500).json({ 
      error: 'Failed to sync appointments',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Testa la sincronizzazione di un appuntamento specifico
 * @param req - Express request object
 * @param res - Express response object
 */
export const testSyncAppointment = async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    
    if (!appointmentId) {
      return res.status(400).json({ message: 'ID appuntamento mancante' });
    }
    
    logMessage(`Testing sync for appointment ID: ${appointmentId}`);
    
    const result = await googleCalendarService.testSyncAppointment(Number(appointmentId));
    
    logMessage(`Test sync result: ${result.success ? 'Success' : 'Failed'} - ${result.message}`);
    
    res.json(result);
  } catch (error) {
    logMessage(`Error testing appointment sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
    res.status(500).json({ 
      error: 'Failed to test appointment sync',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Verifica lo stato dell'integrazione con Google Calendar
 * @param req - Express request object
 * @param res - Express response object
 */
export const checkIntegrationStatus = async (req: Request, res: Response) => {
  try {
    logMessage('Checking Google Calendar integration status');
    
    const status = await googleCalendarService.checkIntegrationStatus();
    
    logMessage(`Integration status: ${status.enabled ? 'Enabled' : 'Disabled'}, ${status.authenticated ? 'Authenticated' : 'Not authenticated'}`);
    
    res.json(status);
  } catch (error) {
    logMessage(`Error checking integration status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    res.status(500).json({ 
      error: 'Failed to check integration status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Sincronizza gli eventi da Google Calendar verso SlabsLink
 * @param req - Express request object
 * @param res - Express response object
 */
export const syncFromGoogleCalendar = async (req: Request, res: Response) => {
  try {
    logMessage('Sincronizzazione manuale degli eventi da Google Calendar verso SlabsLink');
    
    // Verifica se il servizio è abilitato e autenticato
    const isEnabled = await googleCalendarService.isServiceEnabled();
    const isAuthenticated = isEnabled ? await googleCalendarService.isServiceAuthenticated() : false;
    
    if (!isEnabled || !isAuthenticated) {
      return res.status(400).json({
        success: false,
        message: `Sincronizzazione non possibile: servizio ${!isEnabled ? 'non abilitato' : 'non autenticato'}`
      });
    }
    
    // Esegui la sincronizzazione da Google Calendar a SlabsLink
    await googleCalendarService.syncEventsFromGoogleCalendar();
    
    logMessage('Sincronizzazione da Google Calendar a SlabsLink completata con successo');
    
    res.json({
      success: true,
      message: 'Sincronizzazione da Google Calendar completata con successo'
    });
  } catch (error) {
    logMessage(`Errore durante la sincronizzazione da Google Calendar: ${error instanceof Error ? error.message : 'Unknown error'}`);
    res.status(500).json({ 
      success: false,
      error: 'Errore durante la sincronizzazione da Google Calendar',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};