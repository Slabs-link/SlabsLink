import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { getDatabase } from '../config/database-sqlite';
import { AppSetting, CalendarSettings } from '../interfaces/app-setting.interface';
import { Appointment } from '../interfaces/appointment.interface';

export class GoogleCalendarService {
  private oauth2Client: OAuth2Client | null = null;
  private calendar: calendar_v3.Calendar | null = null;

  constructor() {}

  /**
   * Verifica se il servizio è abilitato
   */
  async isServiceEnabled(): Promise<boolean> {
    const db = getDatabase();
    
    // Verifica se la tabella app_settings esiste
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='app_settings'
    `).get();
    
    if (!tableExists) {
      return false;
    }
    
    const setting = db.prepare('SELECT * FROM app_settings WHERE key = ?').get('calendar') as AppSetting | undefined;
    
    if (!setting) {
      return false;
    }
    
    try {
      const calendarSettings = JSON.parse(setting.value);
      return calendarSettings.googleCalendarEnabled === true;
    } catch (error) {
      console.error('Errore nel parsing delle impostazioni di Google Calendar:', error);
      return false;
    }
  }

  /**
   * Verifica se il servizio è autenticato
   */
  async isServiceAuthenticated(): Promise<boolean> {
    const db = getDatabase();
    
    // Verifica se la tabella app_settings esiste
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='app_settings'
    `).get();
    
    if (!tableExists) {
      return false;
    }
    
    const setting = db.prepare('SELECT * FROM app_settings WHERE key = ?').get('calendar') as AppSetting | undefined;
    
    if (!setting) {
      return false;
    }
    
    try {
      const calendarSettings = JSON.parse(setting.value);
      return calendarSettings.tokens !== undefined && calendarSettings.tokens !== null;
    } catch (error) {
      console.error('Errore nel parsing delle impostazioni di Google Calendar:', error);
      return false;
    }
  }

  /**
   * Configura il client OAuth2
   */
  async configure(): Promise<void> {
    const db = getDatabase();
    const setting = db.prepare('SELECT * FROM app_settings WHERE key = ?').get('calendar') as AppSetting | undefined;
    
    if (!setting) {
      throw new Error('Impostazioni di Google Calendar non configurate');
    }
    
    try {
      const calendarSettings = JSON.parse(setting.value);
      
      if (!calendarSettings.clientId || !calendarSettings.clientSecret || !calendarSettings.redirectUri) {
        throw new Error('Credenziali OAuth2 mancanti');
      }
      
      this.oauth2Client = new google.auth.OAuth2(
        calendarSettings.clientId,
        calendarSettings.clientSecret,
        calendarSettings.redirectUri
      );
      
      if (calendarSettings.tokens) {
        this.oauth2Client.setCredentials(calendarSettings.tokens);
        this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      }
    } catch (error) {
      console.error('Errore durante la configurazione di Google Calendar:', error);
      throw error;
    }
  }

  /**
   * Genera l'URL di autenticazione
   */
  async getAuthUrl(): Promise<string> {
    if (!this.oauth2Client) {
      await this.configure();
    }
    
    if (!this.oauth2Client) {
      throw new Error('Google Calendar service non configurato');
    }

    const scopes = ['https://www.googleapis.com/auth/calendar'];
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
    });
  }

  /**
   * Imposta il codice di autorizzazione e ottiene i token
   */
  async setAuthCode(code: string): Promise<void> {
    if (!this.oauth2Client) {
      await this.configure();
    }
    
    if (!this.oauth2Client) {
      throw new Error('Google Calendar service non configurato');
    }

    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      
      // Salva i token nel database
      const db = getDatabase();
      const setting = db.prepare('SELECT * FROM app_settings WHERE key = ?').get('calendar') as AppSetting | undefined;
      
      if (!setting) {
        throw new Error('Impostazioni di Google Calendar non configurate');
      }
      
      const calendarSettings = JSON.parse(setting.value);
      calendarSettings.tokens = tokens;
      
      db.prepare('UPDATE app_settings SET value = ? WHERE key = ?').run(
        JSON.stringify(calendarSettings),
        'calendar'
      );
    } catch (error) {
      console.error('Errore durante lo scambio del codice di autorizzazione:', error);
      throw error;
    }
  }

  /**
   * Crea un evento su Google Calendar
   */
  async createCalendarEvent(appointment: Appointment): Promise<string> {
    if (!this.calendar) {
      await this.configure();
    }
    
    if (!this.calendar) {
      throw new Error('Google Calendar service non autenticato');
    }

    try {
      const event = {
        summary: `Appuntamento: ${appointment.patient_name}`,
        description: appointment.notes || '',
        start: {
          dateTime: new Date(`${appointment.date}T${appointment.time}`).toISOString(),
          timeZone: 'Europe/Rome',
        },
        end: {
          dateTime: new Date(
            new Date(`${appointment.date}T${appointment.time}`).getTime() + 60 * 60 * 1000
          ).toISOString(),
          timeZone: 'Europe/Rome',
        },
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });

      return response.data.id || '';
    } catch (error) {
      console.error('Errore durante la creazione dell\'evento su Google Calendar:', error);
      throw error;
    }
  }

  /**
   * Aggiorna un evento su Google Calendar
   */
  async updateCalendarEvent(appointment: Appointment): Promise<void> {
    if (!this.calendar) {
      await this.configure();
    }
    
    if (!this.calendar || !appointment.google_calendar_event_id) {
      throw new Error('Google Calendar service non autenticato o ID evento mancante');
    }

    try {
      const event = {
        summary: `Appuntamento: ${appointment.patient_name}`,
        description: appointment.notes || '',
        start: {
          dateTime: new Date(`${appointment.date}T${appointment.time}`).toISOString(),
          timeZone: 'Europe/Rome',
        },
        end: {
          dateTime: new Date(
            new Date(`${appointment.date}T${appointment.time}`).getTime() + 60 * 60 * 1000
          ).toISOString(),
          timeZone: 'Europe/Rome',
        },
      };

      await this.calendar.events.update({
        calendarId: 'primary',
        eventId: appointment.google_calendar_event_id,
        requestBody: event,
      });
    } catch (error) {
      console.error('Errore durante l\'aggiornamento dell\'evento su Google Calendar:', error);
      throw error;
    }
  }

  /**
   * Elimina un evento da Google Calendar
   */
  async deleteCalendarEvent(eventId: string): Promise<void> {
    if (!this.calendar) {
      await this.configure();
    }
    
    if (!this.calendar) {
      throw new Error('Google Calendar service non autenticato');
    }

    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
      });
    } catch (error) {
      console.error('Errore durante l\'eliminazione dell\'evento da Google Calendar:', error);
      throw error;
    }
  }

  /**
   * Sincronizza gli appuntamenti con Google Calendar
   */
  async syncAppointments(): Promise<void> {
    if (!await this.isServiceEnabled()) {
      return;
    }

    try {
      if (!this.calendar) {
        await this.configure();
      }
      
      if (!this.calendar) {
        throw new Error('Google Calendar service non autenticato');
      }
      
      const db = getDatabase();
      
      // Ottieni tutti gli appuntamenti non sincronizzati
      const unsyncedAppointments = db.prepare(
        'SELECT * FROM appointments WHERE synced = 0'
      ).all() as Appointment[];
      
      for (const appointment of unsyncedAppointments) {
        try {
          if (!appointment.google_calendar_event_id) {
            // Crea un nuovo evento su Google Calendar
            const eventId = await this.createCalendarEvent(appointment);
            
            // Aggiorna l'appuntamento con l'ID dell'evento di Google Calendar
            db.prepare(
              'UPDATE appointments SET google_calendar_event_id = ?, synced = 1 WHERE id = ?'
            ).run(eventId, appointment.id);
          } else {
            // Aggiorna l'evento esistente su Google Calendar
            await this.updateCalendarEvent(appointment);
            
            // Marca l'appuntamento come sincronizzato
            db.prepare(
              'UPDATE appointments SET synced = 1 WHERE id = ?'
            ).run(appointment.id);
          }
        } catch (error) {
          console.error(`Errore durante la sincronizzazione dell'appuntamento ${appointment.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Errore durante la sincronizzazione con Google Calendar:', error);
    }
  }

  /**
   * Configura il webhook per ricevere notifiche da Google Calendar
   */
  async setupWebhook(baseUrl: string): Promise<any> {
    if (!await this.isServiceEnabled()) {
      throw new Error('Google Calendar service non abilitato');
    }

    try {
      if (!this.calendar) {
        await this.configure();
      }
      
      if (!this.calendar) {
        throw new Error('Google Calendar service non autenticato');
      }
      
      const db = getDatabase();
      const setting = db.prepare('SELECT * FROM app_settings WHERE key = ?').get('calendar') as AppSetting | undefined;
      
      if (!setting) {
        throw new Error('Impostazioni di Google Calendar non configurate');
      }
      
      const calendarSettings = JSON.parse(setting.value);
      
      // Importa dinamicamente uuid
      const { v4: uuidv4 } = await import('uuid');
      
      // Genera un ID univoco per il canale
      const channelId = uuidv4();
      
      // Configura il webhook
      const response = await this.calendar.events.watch({
        calendarId: 'primary',
        requestBody: {
          id: channelId,
          type: 'web_hook',
          address: `${baseUrl}/api/google-calendar/webhook`,
          token: 'token-secret',
          expiration: (Date.now() + 7 * 24 * 60 * 60 * 1000).toString() // 7 giorni
        }
      });
      
      // Salva le informazioni del canale nel database
      calendarSettings.channelId = response.data.id;
      calendarSettings.resourceId = response.data.resourceId;
      calendarSettings.expiration = response.data.expiration;
      
      // Aggiorna le impostazioni nel database
      db.prepare('UPDATE app_settings SET value = ? WHERE key = ?').run(
        JSON.stringify(calendarSettings),
        'calendar'
      );
      
      return {
        channelId: response.data.id,
        expiration: new Date(Number(response.data.expiration)).toISOString()
      };
    } catch (error) {
      console.error('Errore durante la configurazione del webhook:', error);
      throw error;
    }
  }

  /**
   * Interrompe il webhook di Google Calendar
   */
  async stopWebhook(): Promise<void> {
    try {
      if (!this.calendar) {
        await this.configure();
      }
      
      if (!this.calendar) {
        throw new Error('Google Calendar service non autenticato');
      }
      
      const db = getDatabase();
      const setting = db.prepare('SELECT * FROM app_settings WHERE key = ?').get('calendar') as AppSetting | undefined;
      
      if (!setting) {
        throw new Error('Impostazioni di Google Calendar non configurate');
      }
      
      const calendarSettings = JSON.parse(setting.value);
      
      if (!calendarSettings.channelId || !calendarSettings.resourceId) {
        throw new Error('Informazioni del canale mancanti');
      }
      
      // Interrompi il webhook
      await this.calendar.channels.stop({
        requestBody: {
          id: calendarSettings.channelId,
          resourceId: calendarSettings.resourceId
        }
      });
      
      // Rimuovi le informazioni del canale dal database
      delete calendarSettings.channelId;
      delete calendarSettings.resourceId;
      delete calendarSettings.expiration;
      
      // Aggiorna le impostazioni nel database
      db.prepare('UPDATE app_settings SET value = ? WHERE key = ?').run(
        JSON.stringify(calendarSettings),
        'calendar'
      );
    } catch (error) {
      console.error('Errore durante l\'interruzione del webhook:', error);
      throw error;
    }
  }

  /**
   * Ottiene gli eventi da Google Calendar e li sincronizza con gli appuntamenti locali
   */
  async syncEventsFromGoogleCalendar(): Promise<void> {
    if (!await this.isServiceEnabled()) {
      return;
    }

    try {
      if (!this.calendar) {
        await this.configure();
      }
      
      if (!this.calendar) {
        throw new Error('Google Calendar service non autenticato');
      }
      
      const db = getDatabase();
      
      // Ottieni gli eventi da Google Calendar (ultimi 30 giorni e prossimi 90 giorni)
      const now = new Date();
      const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const timeMax = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
      
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime'
      });
      
      const events = response.data.items || [];
      
      for (const event of events) {
        if (!event.id || !event.start || !event.start.dateTime) {
          continue;
        }
        
        // Verifica se l'evento esiste già nel database
        const existingAppointment = db.prepare(
          'SELECT * FROM appointments WHERE google_calendar_event_id = ?'
        ).get(event.id) as Appointment | undefined;
        
        if (existingAppointment) {
          // Aggiorna l'appuntamento esistente solo se non è già sincronizzato
          if (!existingAppointment.synced) {
            this.updateAppointmentFromEvent(existingAppointment.id, event);
          }
        } else {
          // Crea un nuovo appuntamento
          this.createAppointmentFromEvent(event);
        }
      }
    } catch (error) {
      console.error('Errore durante la sincronizzazione degli eventi da Google Calendar:', error);
    }
  }

  /**
   * Crea un appuntamento da un evento di Google Calendar
   */
  private async createAppointmentFromEvent(event: calendar_v3.Schema$Event): Promise<void> {
    try {
      const db = getDatabase();
      
      // Estrai il nome del paziente dal titolo dell'evento
      let patientName = 'Paziente senza nome';
      if (event.summary) {
        const match = event.summary.match(/Appuntamento: (.+)/);
        if (match && match[1]) {
          patientName = match[1];
        } else {
          patientName = event.summary;
        }
      }
      
      // Estrai la data e l'ora dall'evento
      if (!event.start || !event.start.dateTime) {
        throw new Error('Evento senza data di inizio');
      }
      const startDateTime = new Date(event.start.dateTime);
      const date = startDateTime.toISOString().split('T')[0];
      const time = startDateTime.toTimeString().split(' ')[0].substring(0, 5);
      
      // Crea un nuovo appuntamento
      db.prepare(`
        INSERT INTO appointments 
        (patient_name, date, time, notes, google_calendar_event_id, synced, notification_sent, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        patientName,
        date,
        time,
        event.description || '',
        event.id,
        true,
        false,
        'scheduled'
      );
      
      console.log(`Nuovo appuntamento creato da evento Google Calendar: ${event.id}`);
    } catch (error) {
      console.error('Errore durante la creazione dell\'appuntamento da evento Google Calendar:', error);
    }
  }

  /**
   * Aggiorna un appuntamento da un evento di Google Calendar
   */
  private async updateAppointmentFromEvent(appointmentId: number, event: calendar_v3.Schema$Event): Promise<void> {
    try {
      const db = getDatabase();
      
      // Estrai il nome del paziente dal titolo dell'evento
      let patientName = 'Paziente senza nome';
      if (event.summary) {
        const match = event.summary.match(/Appuntamento: (.+)/);
        if (match && match[1]) {
          patientName = match[1];
        } else {
          patientName = event.summary;
        }
      }
      
      // Estrai la data e l'ora dall'evento
      if (!event.start || !event.start.dateTime) {
        throw new Error('Evento senza data di inizio');
      }
      const startDateTime = new Date(event.start.dateTime);
      const date = startDateTime.toISOString().split('T')[0];
      const time = startDateTime.toTimeString().split(' ')[0].substring(0, 5);
      
      // Aggiorna l'appuntamento
      db.prepare(`
        UPDATE appointments 
        SET patient_name = ?,
            date = ?,
            time = ?,
            notes = ?,
            synced = ?
        WHERE id = ?
      `).run(
        patientName,
        date,
        time,
        event.description || '',
        true,
        appointmentId
      );
      
      console.log(`Appuntamento ${appointmentId} aggiornato da evento Google Calendar: ${event.id}`);
    } catch (error) {
      console.error('Errore durante l\'aggiornamento dell\'appuntamento da evento Google Calendar:', error);
    }
  }

  /**
   * Processa un evento di Google Calendar ricevuto tramite webhook
   */
  async processCalendarEvent(resourceState: string, resourceId: string, channelId: string): Promise<void> {
    try {
      if (!this.calendar) {
        await this.configure();
      }
      
      if (!this.calendar) {
        throw new Error('Google Calendar service non autenticato');
      }
      
      const db = getDatabase();
      
      // Gestisci l'evento in base al tipo
      switch (resourceState) {
        case 'sync':
          // Inizializzazione del canale di notifica
          console.log('Canale di notifica inizializzato:', channelId);
          break;
          
        case 'exists':
          // Evento creato o modificato
          // Ottieni i dettagli dell'evento
          const event = await this.calendar.events.get({
            calendarId: 'primary',
            eventId: resourceId
          });
          
          // Verifica se l'evento esiste già nel database
          const existingAppointment = db.prepare(
            'SELECT * FROM appointments WHERE google_calendar_event_id = ?'
          ).get(resourceId) as Appointment | undefined;
          
          if (existingAppointment) {
            // Aggiorna l'appuntamento esistente
            this.updateAppointmentFromEvent(existingAppointment.id, event.data as calendar_v3.Schema$Event);
          } else {
            // Crea un nuovo appuntamento
            this.createAppointmentFromEvent(event.data as calendar_v3.Schema$Event);
          }
          break;
          
        case 'not_exists':
          // Evento eliminato
          // Trova l'appuntamento associato all'evento
          const appointmentToDelete = db.prepare(
            'SELECT * FROM appointments WHERE google_calendar_event_id = ?'
          ).get(resourceId) as Appointment | undefined;
          
          if (appointmentToDelete) {
            // Elimina l'appuntamento
            db.prepare('DELETE FROM appointments WHERE id = ?').run(appointmentToDelete.id);
            console.log(`Appuntamento ${appointmentToDelete.id} eliminato in seguito all'eliminazione dell'evento su Google Calendar`);
          }
          break;
          
        default:
          console.log(`Tipo di evento non gestito: ${resourceState}`);
      }
    } catch (error) {
      console.error('Errore durante l\'elaborazione dell\'evento di Google Calendar:', error);
    }
  }
}