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
   * Funzione di logging per Google Calendar
   * @param level - Livello di log (info, warn, error)
   * @param message - Messaggio da loggare
   * @param data - Dati aggiuntivi opzionali
   */
  private log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const prefix = `[GoogleCalendarService][${timestamp}][${level.toUpperCase()}]`;
    
    // Formatta i dati per una migliore leggibilità se sono un oggetto
    let formattedData = data;
    if (data && typeof data === 'object') {
      try {
        // Rimuovi proprietà troppo verbose o circolari
        const sanitizedData = { ...data };
        if (sanitizedData.tokens) sanitizedData.tokens = '[REDACTED]';
        formattedData = sanitizedData;
      } catch (e) {
        formattedData = 'Impossibile formattare i dati';
      }
    }
    
    if (formattedData) {
      if (level === 'error') {
        console.error(`${prefix} ${message}`, formattedData);
      } else if (level === 'warn') {
        console.warn(`${prefix} ${message}`, formattedData);
      } else {
        console.log(`${prefix} ${message}`, formattedData);
      }
    } else {
      if (level === 'error') {
        console.error(`${prefix} ${message}`);
      } else if (level === 'warn') {
        console.warn(`${prefix} ${message}`);
      } else {
        console.log(`${prefix} ${message}`);
      }
    }
  }

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
    const isEnabled = settings?.googleCalendarEnabled === true;
    this.log('info', `Servizio Google Calendar ${isEnabled ? 'abilitato' : 'disabilitato'}`);
    return isEnabled;
  }

  /**
   * Verifica se il servizio è autenticato
   */
  async isServiceAuthenticated(): Promise<boolean> {
    const settings = await this.getCalendarSettings();
    const isAuthenticated = !!settings?.tokens;
    this.log('info', `Servizio Google Calendar ${isAuthenticated ? 'autenticato' : 'non autenticato'}`);
    return isAuthenticated;
  }

  /**
   * Configura il client OAuth2
   */
  async configure(): Promise<void> {
    this.log('info', 'Configurazione del servizio Google Calendar');
    this.db = getDatabase();
    if (!this.db) {
      this.log('error', 'Connessione al database fallita');
      throw new Error('Database connection failed');
    }
    
    const setting = await (await this.db.get<AppSetting>(
      'SELECT * FROM app_settings WHERE key = ?',
      'calendar'
    ));
    
    if (!setting) {
      this.log('error', 'Impostazioni di Google Calendar non trovate nel database');
      throw new Error('Impostazioni di Google Calendar non configurate');
    }
    
    try {
      const calendarSettings = JSON.parse(setting.value);
      this.log('info', 'Impostazioni di Google Calendar caricate dal database');
      
      if (!calendarSettings.clientId || !calendarSettings.clientSecret || !calendarSettings.redirectUri) {
        this.log('error', 'Credenziali OAuth2 mancanti nelle impostazioni');
        throw new Error('Credenziali OAuth2 mancanti');
      }
      
      this.oauth2Client = new google.auth.OAuth2(
        calendarSettings.clientId,
        calendarSettings.clientSecret,
        calendarSettings.redirectUri
      );
      this.log('info', 'Client OAuth2 creato con successo');
      
      if (calendarSettings.tokens) {
        this.oauth2Client.setCredentials(calendarSettings.tokens);
        this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
        this.log('info', 'Token OAuth2 impostati e client Google Calendar inizializzato');
      } else {
        this.log('warn', 'Token OAuth2 mancanti, autenticazione richiesta');
      }
    } catch (error) {
      this.log('error', 'Errore durante la configurazione di Google Calendar', error);
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
      // Se non ci sono start_time e end_time, proviamo a crearli da date e time
      if (appointment.date && appointment.time && appointment.duration) {
        try {
          // Creiamo le date di inizio e fine dall'appuntamento
          const [year, month, day] = appointment.date.split('-').map(Number);
          const [hours, minutes] = appointment.time.split(':').map(Number);
          
          // Validazione dei valori della data
          if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes) ||
              month < 1 || month > 12 || day < 1 || day > 31 || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            throw new Error(`Invalid date or time values: ${appointment.date} ${appointment.time}`);
          }
          
          // Creiamo la data di inizio
          const startDate = new Date(year, month - 1, day, hours, minutes);
          
          // Verifica che la data sia valida
          if (isNaN(startDate.getTime())) {
            throw new Error(`Invalid date created: ${year}-${month}-${day} ${hours}:${minutes}`);
          }
          
          appointment.start_time = startDate.toISOString();
          
          // Creiamo la data di fine aggiungendo la durata
          const endDate = new Date(startDate.getTime() + appointment.duration * 60 * 1000);
          
          // Verifica che la data di fine sia valida
          if (isNaN(endDate.getTime())) {
            throw new Error(`Invalid end date created with duration: ${appointment.duration}`);
          }
          
          appointment.end_time = endDate.toISOString();
        } catch (error) {
          console.error('Error creating appointment dates:', error);
          throw error;
        }
      } else {
        throw new Error('Missing appointment time parameters');
      }
    }

    // Otteniamo le impostazioni del calendario
    const settings = await this.getCalendarSettings();
    // Usiamo il calendario primario come default
    let calendarId = 'primary';
    
    // Se nelle impostazioni è specificato un calendario specifico, lo usiamo
    if (settings?.selectedCalendarId) {
      calendarId = settings.selectedCalendarId;
    }

    const event: calendar_v3.Schema$Event = {
      summary: `Appuntamento: ${appointment.patient_name}`,
      description: appointment.notes,
      start: {
        dateTime: new Date(appointment.start_time).toISOString(),
        timeZone: 'Europe/Rome',
      },
      end: {
        dateTime: new Date(appointment.end_time).toISOString(),
        timeZone: 'Europe/Rome',
      }
    };

    const response = await this.calendar!.events.insert({
      calendarId: calendarId,
      requestBody: event
    });
    
    return response.data.id || '';
  }

  private async updateCalendarEvent(appointment: Appointment): Promise<void> {
    if (!this.calendar || !appointment.google_calendar_event_id) {
      throw new Error('Servizio non autenticato o ID evento mancante');
    }

    // Se non ci sono start_time e end_time, proviamo a crearli da date e time
    if ((!appointment.start_time || !appointment.end_time) && appointment.date && appointment.time && appointment.duration) {
      // Creiamo le date di inizio e fine dall'appuntamento
      const [year, month, day] = appointment.date.split('-').map(Number);
      const [hours, minutes] = appointment.time.split(':').map(Number);
      
      // Creiamo la data di inizio
      const startDate = new Date(year, month - 1, day, hours, minutes);
      appointment.start_time = startDate.toISOString();
      
      // Creiamo la data di fine aggiungendo la durata
      const endDate = new Date(startDate.getTime() + appointment.duration * 60 * 1000);
      appointment.end_time = endDate.toISOString();
    }

    // Otteniamo le impostazioni del calendario
    const settings = await this.getCalendarSettings();
    // Usiamo il calendario primario come default
    let calendarId = 'primary';
    
    // Se nelle impostazioni è specificato un calendario specifico, lo usiamo
    if (settings?.selectedCalendarId) {
      calendarId = settings.selectedCalendarId;
    }

    const event: calendar_v3.Schema$Event = {
      summary: `Appuntamento: ${appointment.patient_name}`,
      description: appointment.notes,
      start: {
        dateTime: new Date(appointment.start_time).toISOString(),
        timeZone: 'Europe/Rome',
      },
      end: {
        dateTime: new Date(appointment.end_time).toISOString(),
        timeZone: 'Europe/Rome',
      }
    };

    await this.calendar.events.update({
      calendarId: calendarId,
      eventId: appointment.google_calendar_event_id,
      requestBody: event
    });
  }

  async syncAppointment(appointment: Appointment): Promise<{ id: string }> {
    this.log('info', `Inizio sincronizzazione appuntamento ID: ${appointment.id}`, {
      patient_name: appointment.patient_name,
      start_time: appointment.start_time,
      end_time: appointment.end_time,
      has_google_id: !!appointment.google_calendar_event_id
    });
    
    try {
      if (!this.calendar) {
        this.log('info', 'Client Google Calendar non inizializzato, tentativo di configurazione');
        await this.configure();
        if (!this.calendar) {
          this.log('error', 'Impossibile autenticare il servizio Google Calendar dopo la configurazione');
          throw new Error('Google Calendar service not authenticated');
        }
      }

      // Se non ci sono start_time e end_time, proviamo a crearli da date e time
      if (!appointment.start_time || !appointment.end_time) {
        this.log('info', 'Date di inizio/fine mancanti, tentativo di creazione da date e time');
        if (appointment.date && appointment.time && appointment.duration) {
          try {
            // Creiamo le date di inizio e fine dall'appuntamento
            const [year, month, day] = appointment.date.split('-').map(Number);
            const [hours, minutes] = appointment.time.split(':').map(Number);
            
            // Validazione dei valori della data
            if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes) ||
                month < 1 || month > 12 || day < 1 || day > 31 || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
              this.log('error', `Valori di data o ora non validi: ${appointment.date} ${appointment.time}`);
              throw new Error(`Invalid date or time values: ${appointment.date} ${appointment.time}`);
            }
            
            // Creiamo la data di inizio
            const startDate = new Date(year, month - 1, day, hours, minutes);
            
            // Verifica che la data sia valida
            if (isNaN(startDate.getTime())) {
              this.log('error', `Data creata non valida: ${year}-${month}-${day} ${hours}:${minutes}`);
              throw new Error(`Invalid date created: ${year}-${month}-${day} ${hours}:${minutes}`);
            }
            
            appointment.start_time = startDate.toISOString();
            
            // Creiamo la data di fine aggiungendo la durata
            const endDate = new Date(startDate.getTime() + appointment.duration * 60 * 1000);
            
            // Verifica che la data di fine sia valida
            if (isNaN(endDate.getTime())) {
              this.log('error', `Data di fine non valida creata con durata: ${appointment.duration}`);
              throw new Error(`Invalid end date created with duration: ${appointment.duration}`);
            }
            
            appointment.end_time = endDate.toISOString();
            this.log('info', 'Date di inizio/fine create con successo', {
              start_time: appointment.start_time,
              end_time: appointment.end_time
            });
          } catch (error) {
            this.log('error', 'Errore durante la creazione delle date dell\'appuntamento', error);
            // Non propaghiamo l'errore per evitare di interrompere il flusso principale
            return { id: '' };
          }
        } else {
          this.log('error', 'Parametri di tempo dell\'appuntamento mancanti', {
            has_date: !!appointment.date,
            has_time: !!appointment.time,
            has_duration: !!appointment.duration
          });
          // Non propaghiamo l'errore per evitare di interrompere il flusso principale
          return { id: '' };
        }
      }

      let eventId = '';
      try {
        if (!appointment.google_calendar_event_id) {
          // Tentiamo di creare l'evento su Google Calendar
          this.log('info', 'Creazione nuovo evento su Google Calendar');
          try {
            eventId = await this.createCalendarEvent(appointment);
            this.log('info', `Evento creato con successo su Google Calendar, ID: ${eventId}`);
            
            // Aggiorniamo lo stato di sincronizzazione solo se abbiamo un ID evento valido
            if (eventId) {
              try {
                await this.updateLocalAppointmentSyncStatus(appointment.id, 'synced', eventId);
                this.log('info', `Stato di sincronizzazione aggiornato per l'appuntamento ${appointment.id}`);
              } catch (syncError) {
                // Se fallisce l'aggiornamento dello stato, logghiamo ma non interrompiamo
                this.log('warn', `Impossibile aggiornare lo stato di sincronizzazione per l'appuntamento ${appointment.id}. Verrà aggiornato in seguito.`, syncError);
              }
            } else {
              this.log('warn', 'Evento creato ma ID non ricevuto da Google Calendar');
            }
          } catch (calendarError) {
            this.log('error', 'Errore durante la creazione dell\'evento su Google Calendar', calendarError);
            // Tentiamo di aggiornare lo stato come fallito, ma non interrompiamo il flusso
            try {
              await this.updateLocalAppointmentSyncStatus(appointment.id, 'failed');
              this.log('info', `Stato di sincronizzazione impostato come fallito per l'appuntamento ${appointment.id}`);
            } catch (syncError) {
              this.log('warn', `Impossibile aggiornare lo stato di sincronizzazione fallita per l'appuntamento ${appointment.id}.`, syncError);
            }
          }
        } else {
          // Tentiamo di aggiornare l'evento esistente
          this.log('info', `Aggiornamento evento esistente su Google Calendar, ID: ${appointment.google_calendar_event_id}`);
          try {
            await this.updateCalendarEvent(appointment);
            eventId = appointment.google_calendar_event_id;
            this.log('info', `Evento aggiornato con successo su Google Calendar, ID: ${eventId}`);
          } catch (updateError) {
            this.log('error', 'Errore durante l\'aggiornamento dell\'evento su Google Calendar', updateError);
            // Non interrompiamo il flusso principale
          }
        }
        return { id: eventId };
      } catch (error) {
        this.log('error', 'Errore durante la sincronizzazione con Google Calendar', error);
        // Non propaghiamo l'errore per evitare di interrompere il flusso principale
        return { id: '' };
      }
    } catch (error) {
      this.log('error', 'Errore generale durante la sincronizzazione', error);
      // Non propaghiamo l'errore per evitare di interrompere il flusso principale
      return { id: '' };
    }
  }

  private async updateLocalAppointmentSyncStatus(appointmentId: number, status: 'synced' | 'pending' | 'failed', eventId?: string) {
    try {
      this.db = getDatabase();
      if (!this.db) throw new Error('Database connection failed');
      
      // Utilizziamo una query diretta senza prepare per evitare conflitti con transazioni già in corso
      // Questo approccio è più sicuro quando potremmo essere all'interno di una transazione esistente
      try {
        // Utilizziamo una query parametrizzata con il metodo run invece di exec
        // exec accetta solo un argomento (la query SQL) senza parametri
        await this.db.run(
          'UPDATE appointments SET sync_status = ?, google_calendar_event_id = ? WHERE id = ?',
          [status, eventId ?? null, appointmentId]
        );
      } catch (execError) {
        // Se fallisce l'approccio diretto, proviamo con un metodo alternativo
        console.warn(`Tentativo alternativo di aggiornamento per l'appuntamento ${appointmentId}`);
        await this.db.run('UPDATE appointments SET sync_status = ?, google_calendar_event_id = ? WHERE id = ?', 
                   [status, eventId ?? null, appointmentId]);
      }
    } catch (error) {
      // Catturiamo specificamente l'errore di transazione già in corso
      if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' && error.message.includes('within a transaction')) {
        console.warn(`Impossibile aggiornare lo stato di sincronizzazione per l'appuntamento ${appointmentId}: transazione già in corso. L'aggiornamento verrà gestito in seguito.`);
      } else {
        console.error('Errore durante l\'aggiornamento dello stato di sincronizzazione:', error);
      }
      // Non propaghiamo l'errore per evitare di interrompere il flusso principale
    }
  }

  private async getUnsyncedAppointments(): Promise<Appointment[]> {
    this.db = getDatabase();
    if (!this.db) throw new Error('Database connection failed');
    
    // Corretto il metodo di query
    return await this.db.all('SELECT * FROM appointments WHERE sync_status IS NULL') || [];
  }

  private async markAppointmentSynced(appointmentId: number): Promise<void> {
    this.db = getDatabase();
    if (!this.db) throw new Error('Database connection failed');
    
    // Corretto il metodo di query
    await this.db.run('UPDATE appointments SET sync_status = ? WHERE id = ?', 'synced', appointmentId);
  }

  private async handleSyncError(appointmentId: number, error: any): Promise<void> {
    this.db = getDatabase();
    if (!this.db) throw new Error('Database connection failed');
    
    // Corretto il metodo di query
    await this.db.run('UPDATE appointments SET sync_error = ? WHERE id = ?', error.message, appointmentId);
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
   * @returns Un array con i risultati della sincronizzazione
   */
  public async syncAppointments(): Promise<{id: number, success: boolean, message: string}[]> {
    this.log('info', 'Avvio sincronizzazione di tutti gli appuntamenti non sincronizzati');
    
    if (!await this.isServiceEnabled()) {
      this.log('warn', 'Sincronizzazione non eseguita: servizio Google Calendar non abilitato');
      return [{id: 0, success: false, message: 'Servizio Google Calendar non abilitato'}];
    }

    if (!await this.isServiceAuthenticated()) {
      this.log('warn', 'Sincronizzazione non eseguita: servizio Google Calendar non autenticato');
      return [{id: 0, success: false, message: 'Servizio Google Calendar non autenticato'}];
    }

    const unsyncedAppointments = await this.getUnsyncedAppointments();
    this.log('info', `Trovati ${unsyncedAppointments.length} appuntamenti da sincronizzare`);
    
    const results = [];
    
    for (const appointment of unsyncedAppointments) {
      try {
        this.log('info', `Sincronizzazione appuntamento ID: ${appointment.id}`, {
          patient_name: appointment.patient_name,
          date: appointment.date,
          time: appointment.time
        });
        
        if (appointment.google_calendar_event_id) {
          await this.updateCalendarEvent(appointment);
          this.log('info', `Aggiornato evento esistente per appuntamento ID: ${appointment.id}`);
          results.push({id: appointment.id, success: true, message: 'Evento aggiornato con successo'});
        } else {
          const eventId = await this.createCalendarEvent(appointment);
          this.log('info', `Creato nuovo evento per appuntamento ID: ${appointment.id}, Event ID: ${eventId}`);
          // Aggiorna l'ID dell'evento nel database invece di chiamare updateAppointmentFromEvent con un ID
          await this.updateLocalAppointmentSyncStatus(appointment.id, 'synced', eventId);
          results.push({id: appointment.id, success: true, message: `Evento creato con successo, ID: ${eventId}`});
        }
        await this.markAppointmentSynced(appointment.id);
      } catch (error) {
        this.log('error', `Errore durante la sincronizzazione dell'appuntamento ID: ${appointment.id}`, error);
        await this.handleSyncError(appointment.id, error);
        results.push({id: appointment.id, success: false, message: error instanceof Error ? error.message : 'Errore sconosciuto'});
      }
    }
    
    this.log('info', `Sincronizzazione completata per ${results.length} appuntamenti`);
    return results;
  }
  
  /**
   * Verifica lo stato dell'integrazione con Google Calendar
   * @returns Oggetto con informazioni dettagliate sullo stato dell'integrazione
   */
  /**
   * Verifica lo stato dell'integrazione con Google Calendar
   * @returns Oggetto con lo stato dell'integrazione
   */
  public async checkIntegrationStatus(): Promise<{
    enabled: boolean;
    authenticated: boolean;
    calendarId: string | null;
    lastSync: string | null;
    pendingAppointments: number;
    message: string;
  }> {
    this.log('info', 'Verifica dello stato dell\'integrazione con Google Calendar');
    
    try {
      const isEnabled = await this.isServiceEnabled();
      const isAuthenticated = isEnabled ? await this.isServiceAuthenticated() : false;
      
      // Ottieni le impostazioni del calendario
      const settings = await this.getCalendarSettings();
      const calendarId = settings?.selectedCalendarId || 'primary';
      
      // Conta gli appuntamenti in attesa di sincronizzazione
      this.db = getDatabase();
      if (!this.db) throw new Error('Database connection failed');
      
      let pendingCount = { count: 0 };
      let lastSyncRecord = { last_sync: null };
      
      try {
        // Verifica se la tabella appointments esiste
        const tableExists = await this.db.get(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='appointments'"
        );
        
        if (tableExists) {
          // Verifica se la colonna sync_status esiste
          const columnExists = await this.db.get(
            "PRAGMA table_info(appointments)"
          ).then(columns => columns.some((col: any) => col.name === 'sync_status'));
          
          if (columnExists) {
            // Conta gli appuntamenti in attesa di sincronizzazione
            pendingCount = await this.db.get(
              'SELECT COUNT(*) as count FROM appointments WHERE sync_status IS NULL OR sync_status = "pending"'
            ) || { count: 0 };
            
            // Ottieni la data dell'ultima sincronizzazione
            lastSyncRecord = await this.db.get(
              'SELECT MAX(updated_at) as last_sync FROM appointments WHERE sync_status = "synced"'
            ) || { last_sync: null };
          }
        }
      } catch (dbError) {
        this.log('warn', 'Errore durante la query al database', dbError);
        // Continua con i valori predefiniti
      }
      
      let message = '';
      if (!isEnabled) {
        message = 'Integrazione con Google Calendar non abilitata';
      } else if (!isAuthenticated) {
        message = 'Integrazione con Google Calendar non autenticata';
      } else {
        message = 'Integrazione con Google Calendar attiva e funzionante';
      }
      
      const result = {
        enabled: isEnabled,
        authenticated: isAuthenticated,
        calendarId,
        lastSync: lastSyncRecord?.last_sync || null,
        pendingAppointments: pendingCount?.count || 0,
        message
      };
      
      this.log('info', 'Stato dell\'integrazione verificato', result);
      return result;
    } catch (error) {
      this.log('error', 'Errore durante la verifica dello stato dell\'integrazione', error);
      return {
        enabled: false,
        authenticated: false,
        calendarId: null,
        lastSync: null,
        pendingAppointments: 0,
        message: `Errore: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`
      };
    }
  }
  
  /**
   * Testa la sincronizzazione di un appuntamento specifico
   * @param appointmentId ID dell'appuntamento da sincronizzare
   * @returns Risultato del test di sincronizzazione
   */
  public async testSyncAppointment(appointmentId: number): Promise<{
    success: boolean;
    appointmentId: number;
    eventId: string | null;
    message: string;
    details?: any;
  }> {
    this.log('info', `Test di sincronizzazione per l'appuntamento ID: ${appointmentId}`);
    
    try {
      // Verifica se il servizio è abilitato e autenticato
      const isEnabled = await this.isServiceEnabled();
      if (!isEnabled) {
        this.log('warn', 'Test fallito: servizio Google Calendar non abilitato');
        return {
          success: false,
          appointmentId,
          eventId: null,
          message: 'Servizio Google Calendar non abilitato'
        };
      }
      
      const isAuthenticated = await this.isServiceAuthenticated();
      if (!isAuthenticated) {
        this.log('warn', 'Test fallito: servizio Google Calendar non autenticato');
        return {
          success: false,
          appointmentId,
          eventId: null,
          message: 'Servizio Google Calendar non autenticato'
        };
      }
      
      // Configura il client
      await this.configure();
      
      // Ottieni i dettagli dell'appuntamento dal database
      this.db = getDatabase();
      if (!this.db) throw new Error('Database connection failed');
      
      const appointment = await this.db.get(
        'SELECT * FROM appointments WHERE id = ?',
        appointmentId
      );
      
      if (!appointment) {
        this.log('error', `Appuntamento ID: ${appointmentId} non trovato`);
        return {
          success: false,
          appointmentId,
          eventId: null,
          message: 'Appuntamento non trovato'
        };
      }
      
      this.log('info', `Appuntamento trovato, dettagli:`, {
        id: appointment.id,
        patient_name: appointment.patient_name,
        date: appointment.date,
        time: appointment.time,
        duration: appointment.duration,
        google_calendar_event_id: appointment.google_calendar_event_id
      });
      
      // Esegui la sincronizzazione
      const syncResult = await this.syncAppointment(appointment);
      
      if (syncResult && syncResult.id) {
        this.log('info', `Test completato con successo. Event ID: ${syncResult.id}`);
        return {
          success: true,
          appointmentId,
          eventId: syncResult.id,
          message: 'Sincronizzazione completata con successo'
        };
      } else {
        this.log('warn', `Test completato ma nessun ID evento ricevuto`);
        return {
          success: false,
          appointmentId,
          eventId: null,
          message: 'Sincronizzazione completata ma nessun ID evento ricevuto'
        };
      }
    } catch (error) {
      this.log('error', `Errore durante il test di sincronizzazione per l'appuntamento ID: ${appointmentId}`, error);
      return {
        success: false,
        appointmentId,
        eventId: null,
        message: `Errore: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`,
        details: error
      };
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
      const stmt = await this.db.prepare(`
        UPDATE appointments 
        SET patient_name = ?,
            date = ?,
            time = ?,
            notes = ?,
            synced = ?
        WHERE id = ?
      `);
      
      await stmt.run(
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
  public async processCalendarEvent(resourceState: string, resourceId: string, channelId: string): Promise<void> {
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
          await this.handleEvent(resourceId);
          break;
          
        case 'not_exists':
          // Evento eliminato
          // Trova l'appuntamento associato all'evento
          const appointmentToDelete = await this.db.get(
            'SELECT * FROM appointments WHERE google_calendar_event_id = ?',
            resourceId
          ) as Appointment | undefined;
          
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

  /**
   * Ottiene la lista dei calendari disponibili nell'account Google
   */
  async getAvailableCalendars(): Promise<Array<{id: string, summary: string}>> {
    if (!this.calendar) {
      await this.configure();
    }
    
    if (!this.calendar) {
      throw new Error('Google Calendar service non autenticato');
    }

    try {
      const response = await this.calendar.calendarList.list();
      const calendars = response.data.items || [];
      
      // Salva i calendari disponibili nelle impostazioni
      this.db = getDatabase();
      if (!this.db) throw new Error('Database connection failed');
      
      const setting = await this.db.get<AppSetting>(
        'SELECT * FROM app_settings WHERE key = ?',
        'calendar'
      );
      
      if (setting) {
        const calendarSettings = JSON.parse(setting.value);
        calendarSettings.availableCalendars = calendars.map(cal => ({
          id: cal.id || '',
          summary: cal.summary || ''
        }));
        
        await this.db.run(
          'UPDATE app_settings SET value = ? WHERE key = ?',
          JSON.stringify(calendarSettings),
          'calendar'
        );
      }
      
      return calendars.map(cal => ({
        id: cal.id || '',
        summary: cal.summary || ''
      }));
    } catch (error) {
      console.error('Errore durante il recupero dei calendari:', error);
      throw error;
    }
  }

  /**
   * Imposta il calendario selezionato per la sincronizzazione
   */
  async setSelectedCalendar(calendarId: string): Promise<void> {
    this.db = getDatabase();
    if (!this.db) throw new Error('Database connection failed');
    
    const setting = await this.db.get<AppSetting>(
      'SELECT * FROM app_settings WHERE key = ?',
      'calendar'
    );
    
    if (!setting) {
      throw new Error('Impostazioni di Google Calendar non configurate');
    }
  
    try {
      // Verifica che il calendario esista
      if (!this.calendar) {
        await this.configure();
      }
      
      if (!this.calendar) {
        throw new Error('Google Calendar service non autenticato');
      }
      
      // Verifica che il calendario esista
      const response = await this.calendar.calendarList.get({
        calendarId: calendarId
      });
      
      if (!response.data) {
        throw new Error('Calendario non trovato');
      }
      
      // Aggiorna le impostazioni nel database
      const calendarSettings = JSON.parse(setting.value);
      calendarSettings.selectedCalendarId = calendarId;
      
      await this.db.run(
        'UPDATE app_settings SET value = ? WHERE key = ?',
        JSON.stringify(calendarSettings),
        'calendar'
      );
      
      console.log(`Calendario selezionato: ${response.data.summary} (${calendarId})`);
    } catch (error) {
      console.error('Errore durante la selezione del calendario:', error);
      throw error;
    }
  }}
