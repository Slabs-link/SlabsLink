import { Request, Response } from 'express';
import { GoogleCalendarService } from '../services/google-calendar.service';

// Istanza del servizio Google Calendar
const googleCalendarService = new GoogleCalendarService();

/**
 * Ottiene la lista dei calendari disponibili nell'account Google
 * @param req - Express request object
 * @param res - Express response object
 */
export const getAvailableCalendars = async (req: Request, res: Response) => {
  try {
    console.log('[Google Calendar Management Controller] Getting available calendars');
    
    // Verifica se il servizio è autenticato
    const isAuthenticated = await googleCalendarService.isServiceAuthenticated();
    if (!isAuthenticated) {
      return res.status(401).json({ 
        success: false,
        message: 'Google Calendar non autenticato. Autorizza prima l\'accesso.'
      });
    }
    
    // Ottieni la lista dei calendari
    const calendars = await googleCalendarService.getAvailableCalendars();
    
    return res.json({
      success: true,
      calendars
    });
  } catch (error) {
    console.error('Errore durante il recupero dei calendari:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Errore durante il recupero dei calendari',
      error: error instanceof Error ? error.message : 'Errore sconosciuto'
    });
  }
};

/**
 * Imposta il calendario selezionato per la sincronizzazione
 * @param req - Express request object
 * @param res - Express response object
 */
export const setSelectedCalendar = async (req: Request, res: Response) => {
  try {
    console.log('[Google Calendar Management Controller] Setting selected calendar');
    
    const { calendarId } = req.body;
    
    if (!calendarId) {
      return res.status(400).json({ 
        success: false,
        message: 'ID calendario mancante'
      });
    }
    
    // Verifica se il servizio è autenticato
    const isAuthenticated = await googleCalendarService.isServiceAuthenticated();
    if (!isAuthenticated) {
      return res.status(401).json({ 
        success: false,
        message: 'Google Calendar non autenticato. Autorizza prima l\'accesso.'
      });
    }
    
    // Imposta il calendario selezionato
    await googleCalendarService.setSelectedCalendar(calendarId);
    
    return res.json({
      success: true,
      message: 'Calendario selezionato con successo'
    });
  } catch (error) {
    console.error('Errore durante la selezione del calendario:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Errore durante la selezione del calendario',
      error: error instanceof Error ? error.message : 'Errore sconosciuto'
    });
  }
};

/**
 * Crea un nuovo calendario in Google Calendar
 * @param req - Express request object
 * @param res - Express response object
 */
export const createCalendar = async (req: Request, res: Response) => {
  try {
    console.log('[Google Calendar Management Controller] Creating new calendar');
    
    const { calendarName, description } = req.body;
    
    if (!calendarName) {
      return res.status(400).json({ 
        success: false,
        message: 'Nome calendario mancante'
      });
    }
    
    // Verifica se il servizio è autenticato
    const isAuthenticated = await googleCalendarService.isServiceAuthenticated();
    if (!isAuthenticated) {
      return res.status(401).json({ 
        success: false,
        message: 'Google Calendar non autenticato. Autorizza prima l\'accesso.'
      });
    }
    
    // Crea un nuovo calendario
    // Nota: dobbiamo implementare questa funzione nel servizio
    // Per ora restituiamo un errore
    return res.status(501).json({
      success: false,
      message: 'Funzionalità in fase di implementazione'
    });
  } catch (error) {
    console.error('Errore durante la creazione del calendario:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Errore durante la creazione del calendario',
      error: error instanceof Error ? error.message : 'Errore sconosciuto'
    });
  }
};