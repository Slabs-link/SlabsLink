import { Request, Response } from 'express';
import { GoogleCalendarService } from '../services/google-calendar.service';
import { getDatabase } from '../config/database-sqlite';
import { v4 as uuidv4 } from 'uuid';

// Istanza del servizio Google Calendar
const googleCalendarService = new GoogleCalendarService();

// Function to log messages
const logMessage = (message: string, data?: any) => {
  console.log(`[Google Calendar Controller] ${message}`, data ? data : '');
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
      logMessage('Codice di autorizzazione mancante nella richiesta');
      return res.status(400).json({ message: 'Codice di autorizzazione mancante' });
    }
    
    logMessage(`Codice di autorizzazione ricevuto: ${code.toString().substring(0, 10)}...`);
    
    const db = getDatabase();
    if (!db) {
      logMessage('Impossibile ottenere la connessione al database');
      return res.status(500).json({ message: 'Errore di connessione al database' });
    }
    
    logMessage('Ricerca delle impostazioni del calendario nel database');
    const setting = db.prepare('SELECT * FROM app_settings WHERE key = ?').get('calendar') as { value: string };
    
    if (!setting) {
      logMessage('Impostazioni di Google Calendar non trovate nel database');
      return res.status(400).json({ message: 'Impostazioni di Google Calendar non configurate' });
    }
    
    // Converti il valore JSON in oggetto JavaScript
    let calendarSettings;
    try {
      logMessage('Parsing delle impostazioni del calendario');
      calendarSettings = JSON.parse(setting.value?.toString() || '{}');
      logMessage('Impostazioni del calendario parsate con successo', {
        hasClientId: !!calendarSettings.clientId,
        hasClientSecret: !!calendarSettings.clientSecret,
        hasRedirectUri: !!calendarSettings.redirectUri
      });
    } catch (error) {
      logMessage(`Errore nel parsing delle impostazioni: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return res.status(500).json({ message: 'Errore nel parsing delle impostazioni' });
    }
    
    // Importa dinamicamente le librerie di Google
    logMessage('Importazione delle librerie di Google');
    const { google } = await import('googleapis');
    
    // Crea un client OAuth2
    logMessage('Creazione del client OAuth2');
    const oauth2Client = new google.auth.OAuth2(
      calendarSettings.clientId,
      calendarSettings.clientSecret,
      calendarSettings.redirectUri
    );
    
    // Utilizzo del servizio GoogleCalendarService per gestire l'autenticazione
    logMessage('Utilizzo del servizio GoogleCalendarService per gestire l\'autenticazione');
    
    try {
      logMessage(`Tentativo di autenticazione con codice: ${code.toString().substring(0, 10)}...`);
      
      // Verifica che il codice sia valido prima di procedere
      if (!code || typeof code !== 'string' || code.toString().trim() === '') {
        logMessage('Codice di autorizzazione invalido o vuoto');
        return res.status(400).json({ message: 'Codice di autorizzazione invalido' });
      }
      
      // Utilizziamo il metodo setAuthCode del servizio per gestire l'intero processo
      await googleCalendarService.setAuthCode(code.toString());
      
      logMessage('Token OAuth2 ottenuti e salvati con successo tramite il servizio');
      
      // Verifica che i token siano stati effettivamente salvati
      const verifySettings = db.prepare('SELECT * FROM app_settings WHERE key = ?').get('calendar') as { value: string } | undefined;
      
      if (verifySettings) {
        try {
          const verifiedCalendarSettings = JSON.parse(verifySettings.value);
          logMessage('Verifica dei token salvati', {
            tokensPresent: !!verifiedCalendarSettings.tokens,
            hasAccessToken: !!verifiedCalendarSettings.tokens?.access_token,
            accessTokenLength: verifiedCalendarSettings.tokens?.access_token?.length,
            hasRefreshToken: !!verifiedCalendarSettings.tokens?.refresh_token,
            refreshTokenLength: verifiedCalendarSettings.tokens?.refresh_token?.length,
            tokenType: verifiedCalendarSettings.tokens?.token_type,
            expiryDate: verifiedCalendarSettings.tokens?.expiry_date
          });
        } catch (parseError) {
          logMessage(`Errore nel parsing delle impostazioni durante la verifica: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }
      } else {
        logMessage('Impossibile verificare i token salvati: impostazioni non trovate');
      }
    } catch (tokenError) {
      logMessage(`Errore durante il salvataggio dei token: ${tokenError instanceof Error ? tokenError.message : 'Unknown error'}`);
      throw tokenError;
    }
    
    // Inizializza il servizio Google Calendar con i nuovi token
    logMessage('Inizializzazione del servizio Google Calendar');
    // Utilizziamo l'istanza globale del servizio invece di crearne una nuova
    await googleCalendarService.configure();
    const isAuthenticated = await googleCalendarService.isServiceAuthenticated();
    logMessage(`Servizio Google Calendar autenticato: ${isAuthenticated}`);
    
    // Verifica aggiuntiva dello stato di autenticazione
    if (!isAuthenticated) {
      logMessage('ATTENZIONE: Il servizio Google Calendar non risulta autenticato dopo il salvataggio dei token');
      
      // Verifica dettagliata dei token nel database
      const dbCheck = getDatabase();
      const settingCheck = dbCheck.prepare('SELECT * FROM app_settings WHERE key = ?').get('calendar') as { value: string } | undefined;
      
      if (settingCheck) {
        try {
          const parsedSettings = JSON.parse(settingCheck.value);
          logMessage('Verifica approfondita dei token nel database', {
            hasTokens: !!parsedSettings.tokens,
            tokenType: parsedSettings.tokens?.token_type,
            hasAccessToken: !!parsedSettings.tokens?.access_token,
            accessTokenLength: parsedSettings.tokens?.access_token?.length,
            hasRefreshToken: !!parsedSettings.tokens?.refresh_token,
            refreshTokenLength: parsedSettings.tokens?.refresh_token?.length,
            expiryDate: parsedSettings.tokens?.expiry_date
          });
        } catch (e) {
          logMessage(`Errore nel parsing delle impostazioni durante la verifica: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      }
    }
    
    // Reindirizza l'utente alla pagina delle impostazioni
    logMessage('Reindirizzamento alla pagina delle impostazioni');
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