import { Request, Response } from 'express';
import { GoogleCalendarCreateService } from '../services/google-calendar-create.service';

// Istanza del servizio Google Calendar Create
const googleCalendarCreateService = new GoogleCalendarCreateService();

/**
 * Crea un nuovo calendario in Google Calendar
 * @param req - Express request object
 * @param res - Express response object
 */
export const createCalendar = async (req: Request, res: Response) => {
  try {
    console.log('[Google Calendar Create Controller] Creating new calendar');
    
    const { calendarName, description } = req.body;
    
    if (!calendarName) {
      return res.status(400).json({ 
        success: false,
        message: 'Nome calendario mancante'
      });
    }
    
    // Verifica se il servizio è autenticato
    const isAuthenticated = await googleCalendarCreateService.isServiceAuthenticated();
    if (!isAuthenticated) {
      return res.status(401).json({ 
        success: false,
        message: 'Google Calendar non autenticato. Autorizza prima l\'accesso.'
      });
    }
    
    // Crea un nuovo calendario
    const calendarId = await googleCalendarCreateService.createCalendar(calendarName, description);
    
    return res.json({
      success: true,
      message: 'Calendario creato con successo',
      calendarId
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