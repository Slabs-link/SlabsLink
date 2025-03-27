import { OAuth2Client } from 'google-auth-library';
import type { Response } from 'express';
import { google, calendar_v3 } from 'googleapis';
import { getDatabase } from '../config/database';
import type { Database } from 'sqlite';
import { v4 as uuidv4 } from 'uuid';
import { AppSetting, CalendarSettings } from '../interfaces/app-setting.interface';
import { Appointment } from '../interfaces/appointment.interface';

export class GoogleCalendarService {
  private db!: Database;
  private oauth2Client: OAuth2Client | null = null;
  private calendar: calendar_v3.Calendar | null = null;
  private webhookUrl: string | null = null;
  private notificationChannel: string | null = '';

  constructor() {}

  /**
   * Verifica se il servizio è abilitato
   */
  private async getCalendarSettings(): Promise<CalendarSettings | null> {
    this.db = getDatabase();
    if (!this.db) throw new Error('Database connection failed');
    
    const tableExists = await (await this.db.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='app_settings'`
    ));
    
    if (!tableExists) return null;
    
    const setting = await (await this.db.get<AppSetting>(
      'SELECT * FROM app_settings WHERE key = ?',
      'calendar'
    ));
    
    try {
      return setting ? JSON.parse(setting.value) : null;
    } catch (error) {
      console.error('Errore nel parsing delle impostazioni:', error);
      return null;
    }
  }

  async isServiceEnabled(): Promise<boolean> {
    const settings = await this.getCalendarSettings();
    return settings?.googleCalendarEnabled === true;
  }

  /**
   * Verifica se il servizio è autenticato
   */
  async isServiceAuthenticated(): Promise<boolean> {
    const settings = await this.getCalendarSettings();
    return !!settings?.tokens;
  }

  /**
   * Configura il client OAuth2
   */
  async configure(): Promise<void> {
    this.db = getDatabase();
    if (!this.db) throw new Error('Database connection failed');
    const setting = await (await this.db.get<AppSetting>(
      'SELECT * FROM app_settings WHERE key = ?',
      'calendar'
    ));
    
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
      this.db = getDatabase();
    if (!this.db) throw new Error('Database connection failed');
      const setting = await (await this.db.get<AppSetting>(
      'SELECT * FROM app_settings WHERE key = ?',
      'calendar'
    ));
      
      if (!setting) {
        throw new Error('Impostazioni di Google Calendar non configurate');
      }
      
      const calendarSettings = JSON.parse(setting.value);
      calendarSettings.tokens = tokens;
      
      await (await this.db.run(
        'UPDATE app_settings SET value = ? WHERE key = ?',
        JSON.stringify(calendarSettings),
        'calendar'
      ));
    } catch (error) {
      console.error('Errore durante lo scambio del codice di autorizzazione:', error);
      throw error;
    }
  }

  /**
   * Crea un evento su Google Calendar
   */
  async createCalendarEvent(appointment: Appointment): Promise<string> {
    if (!this.calendar) throw new Error('Google Calendar service not authenticated');

    if (!appointment.start_time || !appointment.end_time) {
      throw new Error('Missing appointment time parameters');
    }

    const event: calendar_v3.Schema$Event = {
      summary: `Appuntamento: ${appointment.patient_name}`,
      description: appointment.notes,
      start: {
        dateTime: new Date(appointment.start_time!).toISOString(),
        timeZone: 'Europe/Rome'
      },
      end: {
        dateTime: new Date(appointment.end_time!).toISOString(),
        timeZone: 'Europe/Rome'
      }
    };

    const response = await this.calendar!.events.insert({
      calendarId: 'primary',
      requestBody: event
    });

    return response.data.id || '';
  }

  private async updateCalendarEvent(appointment: Appointment): Promise<void> {
    if (!this.calendar || !appointment.google_calendar_event_id) {
      throw new Error('Servizio non autenticato o ID evento mancante');
    }

    const event: calendar_v3.Schema$Event = {
      summary: `Appuntamento: ${appointment.patient_name}`,
      description: appointment.notes,
      start: {
        dateTime: new Date(appointment.start_time).toISOString(),
        timeZone: 'Europe/Rome'
      },
      end: {
        dateTime: new Date(appointment.end_time).toISOString(),
        timeZone: 'Europe/Rome'
      }
    };

    await this.calendar.events.update({
      calendarId: 'primary',
      eventId: appointment.google_calendar_event_id,
      requestBody: event
    });
  }

  async syncAppointment(appointment: Appointment): Promise<void> {
    try {
      if (!appointment.google_calendar_event_id) {
        const eventId = await this.createCalendarEvent(appointment);
        await this.updateLocalAppointmentSyncStatus(appointment.id, 'synced', eventId);
      } else {
        await this.updateCalendarEvent(appointment);
      }
    } catch (error) {
      await this.updateLocalAppointmentSyncStatus(appointment.id, 'failed');
      throw error;
    }
  }

  private async updateLocalAppointmentSyncStatus(appointmentId: number, status: 'synced' | 'pending' | 'failed', eventId?: string) {
    this.db = getDatabase();
    if (!this.db) throw new Error('Database connection failed');
    await (await this.db.prepare(
      'UPDATE appointments SET sync_status = ?, google_calendar_event_id = ? WHERE id = ?'
    )).run(appointmentId, status, eventId ?? null);
  }

  private async getUnsyncedAppointments(): Promise<Appointment[]> {
    return (await this.db?.prepare('SELECT * FROM appointments WHERE sync_status IS NULL'))?.all() || [];
  }

  private async markAppointmentSynced(appointmentId: number): Promise<void> {
    await (await this.db?.prepare('UPDATE appointments SET sync_status = 1 WHERE id = ?')).run(appointmentId);
  }

  private async handleSyncError(appointmentId: number, error: any): Promise<void> {
    await (await this.db?.prepare('UPDATE appointments SET sync_error = ? WHERE id = ?'))
      .run(error.message, appointmentId);
  }

  async handleEvent(resourceId: string): Promise<void> {
    try {
      const response = await this.calendar?.events.get({
        calendarId: 'primary',
        eventId: resourceId
      });

      if (!response || !response.data) {
        throw new Error('Evento non trovato');
      }
      
      const event = response.data;

      this.db = getDatabase();
      if (!this.db) throw new Error('Database connection failed');
      const appointment = await (await this.db.prepare(
        'SELECT * FROM appointments WHERE google_calendar_event_id = ?'
      )).get(event.id) as Appointment | undefined;

      if (appointment) {
        await (await this.db.prepare(
          'UPDATE appointments SET start_time = ?, end_time = ?, notes = ? WHERE id = ?'
        )).run(
          new Date(event.start?.dateTime ?? new Date()).toISOString(),
          new Date(event.end?.dateTime ?? new Date()).toISOString(),
          event.description || '',
          appointment.id
        );
      } else if (this.notificationChannel) {
        await this.createAppointmentInDatabase(event);
      }
    } catch (error) {
      console.error(`Errore durante l'aggiornamento da Google Calendar:`, error);
    }
  }

  

  /**
   * Aggiorna un evento su Google Calendar
   */
  

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
      this.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId
      });
    } catch (error) {
      console.error('Errore durante l\'eliminazione dell\'evento da Google Calendar:', error);
      throw error;
    }
  }

  /**
   * Sincronizza gli appuntamenti con Google Calendar
   */
  private async syncAppointments(): Promise<void> {
    if (!await this.isServiceEnabled()) return;

    const unsyncedAppointments = await this.getUnsyncedAppointments();
    
    for (const appointment of unsyncedAppointments) {
      try {
        if (appointment.google_calendar_event_id) {
          await this.updateCalendarEvent(appointment);
        } else {
          const eventId = await this.createCalendarEvent(appointment);
          // Aggiorna l'ID dell'evento nel database invece di chiamare updateAppointmentFromEvent con un ID
          await this.updateLocalAppointmentSyncStatus(appointment.id, 'synced', eventId);
        }
        await this.markAppointmentSynced(appointment.id);
      } catch (error) {
        await this.handleSyncError(appointment.id, error);
      }
    }
  }

  private async createAppointmentFromEvent(event: calendar_v3.Schema$Event): Promise<Appointment> {
    if (!event.start) {
      throw new Error('Evento senza data di inizio');
    }
    
    return {
      id: 0, // ID temporaneo, verrà assegnato dal database
      patient_name: event.summary?.replace('Appuntamento: ', '') || '',
      notes: event.description || '',
      start_time: new Date(event.start.dateTime || event.start.date || new Date()).toISOString(),
      end_time: new Date(event.end?.dateTime || event.end?.date || new Date()).toISOString(),
      google_calendar_event_id: event.id || null,
      synced: 1
    };
  }

  /**
   * Configura il webhook per ricevere notifiche da Google Calendar
   */
  async setupWebhook(baseUrl: string): Promise<string> {
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
      
      this.db = getDatabase();
    if (!this.db) throw new Error('Database connection failed');
      const setting = await (await this.db.get<AppSetting>(
      'SELECT * FROM app_settings WHERE key = ?',
      'calendar'
    ));
      
      if (!setting) {
        throw new Error('Impostazioni di Google Calendar non configurate');
      }
      
      const calendarSettings = JSON.parse(setting.value);
      
      // Importa dinamicamente uuid
      
      // Genera un ID univoco per il canale
      const channelId = uuidv4();
      
      // Configura il webhook
      const webhookConfig = await this.calendar.events.watch({
    calendarId: 'primary',
    requestBody: {
      id: uuidv4(),
      type: 'web_hook',
      address: `${baseUrl}/api/google-calendar/webhook`,
      expiration: (Date.now() + 7 * 24 * 60 * 60 * 1000).toString()
    }
  });

  const webhookChannelId: string | null = webhookConfig.data?.id ?? null;
  const resourceId: string | null = webhookConfig.data?.resourceId ?? null;
  const expiration: string | null = webhookConfig.data?.expiration?.toString() ?? null;
      
      // Salva le informazioni del canale nel database
      calendarSettings.channelId = webhookChannelId;
      calendarSettings.resourceId = resourceId;
      calendarSettings.expiration = expiration ? new Date(Number(expiration)).toISOString() : null;
      
      // Aggiorna le impostazioni nel database
      await (await this.db.run(
        'UPDATE app_settings SET value = ? WHERE key = ?',
        JSON.stringify(calendarSettings),
        'calendar'
      ));
      
      this.notificationChannel = webhookChannelId;
      if (!webhookChannelId) {
        throw new Error('Failed to create webhook channel');
      }
      return webhookChannelId;
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
      
      this.db = getDatabase();
    if (!this.db) throw new Error('Database connection failed');
      const setting = await (await this.db.get<AppSetting>(
      'SELECT * FROM app_settings WHERE key = ?',
      'calendar'
    ));
      
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
      await (await this.db.run(
        'UPDATE app_settings SET value = ? WHERE key = ?',
        JSON.stringify(calendarSettings),
        'calendar'
      ));
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
      
      this.db = getDatabase();
    if (!this.db) throw new Error('Database connection failed');
      
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
        const existingAppointment = (await this.db.prepare(
          'SELECT * FROM appointments WHERE google_calendar_event_id = ?'
        )).get(event.id) as unknown as Appointment | undefined;
        
        if (existingAppointment) {
          // Aggiorna l'appuntamento esistente solo se non è già sincronizzato
          if (!existingAppointment.synced) {
            this.updateAppointmentFromEvent(existingAppointment.id, event);
          }
        } else {
          // Crea un nuovo appuntamento
          this.createAppointmentInDatabase(event);
        }
      }
    } catch (error) {
      console.error('Errore durante la sincronizzazione degli eventi da Google Calendar:', error);
    }
  }

  /**
   * Crea un appuntamento nel database da un evento di Google Calendar
   */
  private async createAppointmentInDatabase(event: calendar_v3.Schema$Event): Promise<Appointment> {
    if (!this.db) throw new Error('Database non inizializzato');
    const startTime = new Date(event.start?.dateTime || '');
    const endTime = new Date(event.end?.dateTime || '');

    const result = await this.db.run(
      'INSERT INTO appointments (patient_name, start_time, end_time, notes) VALUES (?, ?, ?, ?)',
      [event.summary?.replace('Appuntamento: ', '') || '', startTime.toISOString(), endTime.toISOString(), event.description || '']
    );

    return {
      id: result.lastID || 0,
      patient_name: event.summary?.replace('Appuntamento: ', '') || '',
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      notes: event.description || '',
      google_calendar_event_id: event.id || null
    };
  }

  /**
   * Aggiorna un appuntamento da un evento di Google Calendar
   */
  private async updateAppointmentFromEvent(appointmentId: number | undefined, event: calendar_v3.Schema$Event): Promise<void> {
    try {
      this.db = getDatabase();
    if (!this.db) throw new Error('Database connection failed');
      
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
      (await this.db.prepare(`
        UPDATE appointments 
        SET patient_name = ?,
            date = ?,
            time = ?,
            notes = ?,
            synced = ?
        WHERE id = ?
      `)).run(
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
      
      this.db = getDatabase();
    if (!this.db) throw new Error('Database connection failed');
      
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
          const existingAppointment = await this.db.get<Appointment | undefined>(
            'SELECT * FROM appointments WHERE google_calendar_event_id = ?',
            resourceId
          );
          
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
          const appointmentToDelete = (await this.db.prepare(
            'SELECT * FROM appointments WHERE google_calendar_event_id = ?'
          )).get(resourceId) as unknown as Appointment | undefined;
          
          if (appointmentToDelete) {
            // Elimina l'appuntamento
            await this.db.run('DELETE FROM appointments WHERE id = ?', appointmentToDelete.id);
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