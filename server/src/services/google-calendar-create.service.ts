import { GoogleCalendarService } from './google-calendar.service';
import { google } from 'googleapis';

/**
 * Servizio per la creazione di calendari in Google Calendar
 * Estende le funzionalità del servizio GoogleCalendarService
 */
export class GoogleCalendarCreateService extends GoogleCalendarService {
  
  /**
   * Crea un nuovo calendario in Google Calendar
   * @param calendarName Nome del nuovo calendario
   * @param description Descrizione opzionale del calendario
   * @returns ID del calendario creato
   */
  async createCalendar(calendarName: string, description?: string): Promise<string> {
    if (!this.getCalendar()) {
      await this.configure();
    }
    
    if (!this.getCalendar()) {
      throw new Error('Google Calendar service non autenticato');
    }

    try {
      // Crea il nuovo calendario
      const response = await this.getCalendar()!.calendars.insert({
        requestBody: {
          summary: calendarName,
          description: description || `Calendario creato da SlabsLink per la gestione degli appuntamenti`,
          timeZone: 'Europe/Rome'
        }
      });

      if (!response.data.id) {
        throw new Error('Errore durante la creazione del calendario: ID mancante nella risposta');
      }

      const calendarId = response.data.id;
      
      // Imposta automaticamente il nuovo calendario come calendario selezionato
      await this.setSelectedCalendar(calendarId);
      
      return calendarId;
    } catch (error) {
      console.error('Errore durante la creazione del calendario:', error);
      throw error;
    }
  }
}