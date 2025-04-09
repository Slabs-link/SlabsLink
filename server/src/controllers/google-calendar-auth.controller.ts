import { Request, Response } from 'express';
import { GoogleCalendarService } from '../services/google-calendar.service';

// Istanza del servizio Google Calendar
const googleCalendarService = new GoogleCalendarService();

// Function to log messages
const logMessage = (message: string, data?: any) => {
  console.log(`[Google Calendar Auth Controller] ${message}`, data ? data : '');
};

/**
 * Ottiene lo stato attuale dell'autenticazione di Google Calendar
 * @param req - Express request object
 * @param res - Express response object
 */
export const getAuthStatus = async (req: Request, res: Response) => {
  try {
    logMessage('Verifica dello stato di autenticazione di Google Calendar');
    
    // Verifica se il servizio è abilitato
    const isEnabled = await googleCalendarService.isServiceEnabled();
    const isAuthenticated = isEnabled ? await googleCalendarService.isServiceAuthenticated() : false;
    
    // Ottieni le impostazioni del calendario per verificare lo stato dei token
    const calendarSettings = await googleCalendarService.getCalendarSettings();
    
    // Verifica se i token sono scaduti
    let tokenExpired = false;
    let tokenError = null;
    
    if (calendarSettings?.tokens?.expiry_date) {
      const expiryDate = new Date(calendarSettings.tokens.expiry_date);
      const now = new Date();
      tokenExpired = expiryDate <= now;
    }
    
    // Se il servizio non è autenticato e i token sono presenti, potrebbe esserci un problema con i token
    if (!isAuthenticated && calendarSettings?.tokens?.access_token) {
      if (tokenExpired) {
        tokenError = 'token_expired';
        logMessage('Token di Google Calendar scaduto o revocato. È necessario riautenticarsi.');
      } else {
        tokenError = 'token_invalid';
        logMessage('Token di Google Calendar non valido. È necessario riautenticarsi.');
      }
    }
    
    return res.json({
      enabled: isEnabled,
      authenticated: isAuthenticated,
      hasTokens: !!calendarSettings?.tokens?.access_token,
      tokenExpired,
      error: tokenError,
      lastChecked: new Date().toISOString(),
      message: tokenError === 'token_expired' ? 'Il token di Google Calendar è scaduto o è stato revocato. È necessario riautenticarsi.' : 
               tokenError === 'token_invalid' ? 'Il token di Google Calendar non è valido. È necessario riautenticarsi.' : null
    });
  } catch (error) {
    logMessage(`Errore durante la verifica dello stato di autenticazione: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return res.status(500).json({ 
      error: 'Errore durante la verifica dello stato di autenticazione',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};