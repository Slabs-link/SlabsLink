import { GoogleCalendarService } from './google-calendar.service';
import { getDatabase } from '../config/database-sqlite';
import { calendar_v3 } from 'googleapis';
import { convertToGoogleCalendarEvent } from '../utils/google-calendar-utils';
import { v4 as uuidv4 } from 'uuid';
import { Database } from 'better-sqlite3';
import { Appointment } from '../interfaces/appointment.interface';

/**
 * Servizio per la gestione delle notifiche di Google Calendar
 * Estende le funzionalità del servizio GoogleCalendarService
 * per gestire la sincronizzazione bidirezionale
 */
export class GoogleCalendarWatchService extends GoogleCalendarService {
  /**
   * Genera un link di prenotazione per il calendario selezionato
   * Questo link può essere inviato agli utenti per permettere loro di prenotare appuntamenti
   * @returns URL di prenotazione di Google Calendar
   */
  async generateBookingLink(): Promise<string> {
    this.log('info', 'Generazione link di prenotazione per Google Calendar');
    
    // Verifica che il servizio sia autenticato
    const isAuthenticated = await this.isServiceAuthenticated();
    if (!isAuthenticated) {
      this.log('error', 'Impossibile generare link di prenotazione: servizio non autenticato');
      throw new Error('Servizio Google Calendar non autenticato');
    }
    
    // Ottieni le impostazioni del calendario
    const settings = await this.getCalendarSettings();
    if (!settings || !settings.selectedCalendarId) {
      this.log('error', 'Impossibile generare link di prenotazione: nessun calendario selezionato');
      throw new Error('Nessun calendario selezionato');
    }
    
    try {
      // Ottieni il calendario
      const calendar = this.getCalendar();
      if (!calendar) {
        throw new Error('Client Google Calendar non inizializzato');
      }
      
      // Ottieni le informazioni sul calendario selezionato
      const calendarInfo = await calendar.calendars.get({
        calendarId: settings.selectedCalendarId
      });
      
      // Genera il link di prenotazione
      // Il formato del link di prenotazione è: https://calendar.google.com/calendar/appointments/schedules/[CALENDAR_ID]
      const bookingLink = `https://calendar.google.com/calendar/appointments/schedules/${settings.selectedCalendarId}`;
      
      this.log('info', 'Link di prenotazione generato con successo', { bookingLink });
      
      return bookingLink;
    } catch (error) {
      this.log('error', 'Errore durante la generazione del link di prenotazione', error);
      throw error;
    }
  }
  
  /**
   * Crea un nuovo utente dai dati forniti durante la prenotazione
   * @param userData - Dati dell'utente estratti dall'evento di prenotazione
   * @returns ID del nuovo utente
   */
  private async createUserFromBookingData(userData: {
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
  }): Promise<number> {
    this.log('info', 'Creazione nuovo utente dai dati di prenotazione', userData);
    
    try {
      const db = getDatabase();
      if (!db) {
        throw new Error('Database non disponibile');
      }
      
      // Verifica se l'utente esiste già (per email se disponibile)
      if (userData.email) {
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(userData.email) as { id: number } | undefined;
        if (existingUser && existingUser.id) {
          this.log('info', `Utente con email ${userData.email} già esistente, ID: ${existingUser.id}`);
          return existingUser.id;
        }
      }
      
      // Verifica se l'utente esiste già (per nome e cognome)
      const existingUserByName = db.prepare(
        'SELECT id FROM users WHERE first_name = ? AND last_name = ?'
      ).get(userData.first_name, userData.last_name) as { id: number } | undefined;
      
      if (existingUserByName && existingUserByName.id) {
        this.log('info', `Utente con nome ${userData.first_name} ${userData.last_name} già esistente, ID: ${existingUserByName.id}`);
        return existingUserByName.id;
      }
      
      // Crea un nuovo utente
      const result = db.prepare(`
        INSERT INTO users (
          first_name, last_name, email, phone, created_at, updated_at
        ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        userData.first_name,
        userData.last_name,
        userData.email || null,
        userData.phone || null
      );
      
      const newUserId = result.lastInsertRowid as number;
      this.log('info', `Nuovo utente creato con ID: ${newUserId}`);
      
      return newUserId;
    } catch (error) {
      this.log('error', 'Errore durante la creazione dell\'utente', error);
      throw error;
    }
  }
  
  /**
   * Estrae i dati dell'utente dalla descrizione dell'evento di prenotazione
   * @param event - Evento di Google Calendar
   * @returns Dati dell'utente
   */
  private extractUserDataFromBookingEvent(event: calendar_v3.Schema$Event): {
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
  } {
    this.log('info', 'Estrazione dati utente dall\'evento di prenotazione');
    
    // Inizializza i dati dell'utente con valori predefiniti
    const userData: {
      first_name: string;
      last_name: string;
      email?: string;
      phone?: string;
    } = {
      first_name: 'Utente',
      last_name: 'Sconosciuto'
    };
    
    // Estrai il nome dal titolo dell'evento
    if (event.summary) {
      // Assumiamo che il titolo possa contenere il nome completo dell'utente
      const nameParts = event.summary.split(' ');
      if (nameParts.length >= 2) {
        userData.first_name = nameParts[0];
        userData.last_name = nameParts.slice(1).join(' ');
      } else if (nameParts.length === 1) {
        userData.first_name = nameParts[0];
      }
    }
    
    // Estrai email e telefono dalla descrizione dell'evento
    if (event.description) {
      // Cerca pattern come "Email: example@example.com" o "E-mail: example@example.com"
      const emailMatch = event.description.match(/e[-]?mail\s*:\s*([^\s\n]+)/i);
      if (emailMatch && emailMatch[1]) {
        userData.email = emailMatch[1].trim();
      }
      
      // Cerca pattern come "Telefono: 1234567890" o "Tel: 1234567890"
      const phoneMatch = event.description.match(/(?:telefono|tel)\s*:\s*([^\s\n]+)/i);
      if (phoneMatch && phoneMatch[1]) {
        userData.phone = phoneMatch[1].trim();
      }
      
      // Cerca pattern come "Nome: Mario" o "Nome e Cognome: Mario Rossi"
      const nameMatch = event.description.match(/nome(?:\s+e\s+cognome)?\s*:\s*([^\n]+)/i);
      if (nameMatch && nameMatch[1]) {
        const fullName = nameMatch[1].trim();
        const nameParts = fullName.split(' ');
        if (nameParts.length >= 2) {
          userData.first_name = nameParts[0];
          userData.last_name = nameParts.slice(1).join(' ');
        } else if (nameParts.length === 1) {
          userData.first_name = nameParts[0];
        }
      }
    }
    
    // Estrai email dall'organizzatore dell'evento
    if (event.organizer && event.organizer.email && event.organizer.email !== 'calendar-notification@google.com') {
      userData.email = event.organizer.email;
    }
    
    // Estrai email dai partecipanti dell'evento
    if (event.attendees && event.attendees.length > 0) {
      for (const attendee of event.attendees) {
        if (attendee.email && attendee.email !== 'calendar-notification@google.com') {
          userData.email = attendee.email;
          break;
        }
      }
    }
    
    return userData;
  }
  
  /**
   * Verifica se un evento è stato creato tramite la funzionalità di prenotazione
   * @param event - Evento di Google Calendar
   * @returns true se l'evento è stato creato tramite prenotazione, false altrimenti
   */
  private isBookingEvent(event: calendar_v3.Schema$Event): boolean {
    // Verifica se l'evento ha metadati che indicano che è stato creato tramite prenotazione
    if (event.extendedProperties?.private?.['booking'] === 'true') {
      return true;
    }
    
    // Verifica se l'evento ha un creatore che non è l'utente autenticato
    if (event.creator && event.creator.self === false) {
      return true;
    }
    
    // Verifica se l'evento ha partecipanti esterni
    if (event.attendees && event.attendees.length > 0) {
      for (const attendee of event.attendees) {
        if (attendee.self === false) {
          return true;
        }
      }
    }
    
    // Verifica se l'evento ha una descrizione che contiene informazioni tipiche di una prenotazione
    if (event.description && (
      event.description.includes('prenotazione') ||
      event.description.includes('appuntamento') ||
      event.description.includes('booking') ||
      event.description.includes('appointment') ||
      event.description.match(/e[-]?mail\s*:/i) ||
      event.description.match(/(?:telefono|tel)\s*:/i) ||
      event.description.match(/nome(?:\s+e\s+cognome)?\s*:/i)
    )) {
      return true;
    }
    
    return false;
  }
  /**
   * Configura un webhook per ricevere notifiche quando gli eventi del calendario vengono modificati
   * @param baseUrl - URL base dell'applicazione
   * @returns ID del canale di notifica
   */
  async setupCalendarWatch(baseUrl: string): Promise<string> {
    this.log('info', 'Configurazione webhook per le notifiche di Google Calendar');
    
    // Verifica che il servizio sia autenticato
    const isAuthenticated = await this.isServiceAuthenticated();
    if (!isAuthenticated) {
      this.log('error', 'Impossibile configurare webhook: servizio non autenticato');
      throw new Error('Servizio Google Calendar non autenticato');
    }
    
    // Ottieni le impostazioni del calendario
    const settings = await this.getCalendarSettings();
    if (!settings || !settings.selectedCalendarId) {
      this.log('error', 'Impossibile configurare webhook: nessun calendario selezionato');
      throw new Error('Nessun calendario selezionato');
    }
    
    try {
      // Genera un ID univoco per il canale
      const channelId = uuidv4();
      
      // Configura il webhook
      const calendar = this.getCalendar();
      if (!calendar) {
        throw new Error('Client Google Calendar non inizializzato');
      }
      
      // Crea la richiesta di watch
      const watchRequest = {
        id: channelId,
        type: 'web_hook',
        address: `${baseUrl}/api/google-calendar/webhook`,
        params: {
          ttl: '604800' // 7 giorni in secondi
        }
      };
      
      // Esegui la richiesta di watch
      const response = await calendar.events.watch({
        calendarId: settings.selectedCalendarId,
        requestBody: watchRequest
      });
      
      // Salva le informazioni sul canale nel database
      const db = getDatabase();
      if (db) {
        // Verifica se esiste già un record per questo canale
        const existingChannel = db.prepare('SELECT * FROM google_calendar_channels WHERE channel_id = ?').get(channelId);
        
        if (existingChannel) {
          // Aggiorna il record esistente
          db.prepare(`
            UPDATE google_calendar_channels SET 
            resource_id = ?, 
            expiration = ?, 
            calendar_id = ?, 
            updated_at = CURRENT_TIMESTAMP 
            WHERE channel_id = ?
          `).run(
            response.data.resourceId,
            response.data.expiration,
            settings.selectedCalendarId,
            channelId
          );
        } else {
          // Crea un nuovo record
          db.prepare(`
            INSERT INTO google_calendar_channels (
              channel_id, 
              resource_id, 
              expiration, 
              calendar_id, 
              created_at, 
              updated_at
            ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).run(
            channelId,
            response.data.resourceId,
            response.data.expiration,
            settings.selectedCalendarId
          );
        }
      }
      
      this.log('info', 'Webhook configurato con successo', {
        channelId,
        resourceId: response.data.resourceId,
        expiration: response.data.expiration
      });
      
      return channelId;
    } catch (error) {
      this.log('error', 'Errore durante la configurazione del webhook', error);
      throw error;
    }
  }
  
  /**
   * Gestisce un evento ricevuto da Google Calendar
   * @param resourceId - ID della risorsa modificata
   */
  /**
   * Crea una notifica per un appuntamento
   * @param appointmentId - ID dell'appuntamento
   * @param patientId - ID del paziente
   * @param notificationType - Tipo di notifica (creation, update, cancellation)
   */
  private async createNotificationForAppointment(appointmentId: number, patientId: number, notificationType: 'creation' | 'update' | 'cancellation'): Promise<void> {
    try {
      const db = getDatabase();
      if (!db) {
        throw new Error('Database non disponibile');
      }
      
      // Determina il tipo di template da utilizzare
      let templateType = '';
      switch (notificationType) {
        case 'creation':
          templateType = 'appointment_created';
          break;
        case 'update':
          templateType = 'appointment_update';
          break;
        case 'cancellation':
          templateType = 'appointment_cancellation';
          break;
      }
      
      // Ottieni il template appropriato
      const template = db.prepare(`
        SELECT * FROM notification_templates 
        WHERE type = ? 
        LIMIT 1
      `).get(templateType) as { id: number, content: string };
      
      if (!template) {
        this.log('warn', `Template per ${templateType} non trovato`);
        return;
      }
      
      // Ottieni i dettagli del paziente
      const patient = db.prepare(`
        SELECT first_name, last_name, phone FROM users 
        WHERE id = ?
      `).get(patientId) as { first_name: string, last_name: string, phone: string };
      
      if (!patient) {
        this.log('warn', `Paziente con ID ${patientId} non trovato`);
        return;
      }
      
      // Ottieni i dettagli dell'appuntamento
      const appointment = db.prepare(`
        SELECT date, time, title FROM appointments 
        WHERE id = ?
      `).get(appointmentId) as { date: string, time: string, title: string };
      
      if (!appointment) {
        this.log('warn', `Appuntamento con ID ${appointmentId} non trovato`);
        return;
      }
      
      // Ottieni le impostazioni generali per il nome dell'azienda
      const generalSettings = db.prepare('SELECT * FROM app_settings WHERE key = ?').get('general') as { value: string } | undefined;
      let clinicName = 'SlabsLink';
      
      if (generalSettings) {
        try {
          const settings = JSON.parse(generalSettings.value);
          if (settings && settings.clinicName) {
            clinicName = settings.clinicName;
          }
        } catch (error) {
          this.log('error', 'Errore nel parsing delle impostazioni generali', error);
        }
      }
      
      // Sostituisci le variabili nel template
      let message = template.content
        .replace(/\{\{first_name\}\}|\{first_name\}/g, patient.first_name || '')
        .replace(/\{\{last_name\}\}|\{last_name\}/g, patient.last_name || '')
        .replace(/\{\{appointment_date\}\}|\{appointment_date\}/g, appointment.date || '')
        .replace(/\{\{appointment_time\}\}|\{appointment_time\}/g, appointment.time || '')
        .replace(/\{\{appointment_title\}\}|\{appointment_title\}/g, appointment.title || 'Appuntamento')
        .replace(/\{\{clinic_name\}\}|\{clinic_name\}/g, clinicName)
        .replace(/SlabsLink/g, clinicName); // Retrocompatibilità
      
      // Inserisci la notifica
      const notificationInsert = db.prepare(`
        INSERT INTO notifications (
          user_id, message, status, template_id, appointment_id, phone, created_at, updated_at
        ) VALUES (?, ?, 'pending', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      
      const notificationResult = notificationInsert.run(
        patientId,
        message,
        template.id,
        appointmentId,
        patient.phone || null
      );
      
      // Ottieni l'ID della notifica appena creata
      const notificationId = notificationResult.lastInsertRowid;
      
      this.log('info', `Notifica ID ${notificationId} creata per l'appuntamento ${appointmentId} (${notificationType})`);
    } catch (error) {
      this.log('error', `Errore nella creazione della notifica per l'appuntamento: ${error}`);
    }
  }
  
  /**
   * Processa un evento di calendario in base allo stato della risorsa e all'ID della risorsa
   * Implementazione del metodo della classe base
   */
  async processCalendarEvent(resourceState: string, resourceId: string, channelId: string): Promise<void> {
    this.log('info', `Processamento evento di calendario: stato=${resourceState}, resourceId=${resourceId}, channelId=${channelId}`);
    await this.handleCalendarEvent(resourceId);
  }
  
  /**
   * Gestisce un evento ricevuto da Google Calendar
   * @param resourceId - ID della risorsa modificata
   */
  async handleCalendarEvent(resourceId: string): Promise<void> {
    this.log('info', `Gestione evento Google Calendar con resourceId: ${resourceId}`);
    
    try {
      // Verifica che il servizio sia autenticato
      const isAuthenticated = await this.isServiceAuthenticated();
      if (!isAuthenticated) {
        this.log('error', 'Impossibile gestire evento: servizio non autenticato');
        throw new Error('Servizio Google Calendar non autenticato');
      }
      
      // Ottieni le informazioni sul canale dal database
      const db = getDatabase();
      if (!db) {
        throw new Error('Database non disponibile');
      }
      
      const channel = db.prepare('SELECT * FROM google_calendar_channels WHERE resource_id = ?').get(resourceId);
      if (!channel) {
        this.log('warn', `Nessun canale trovato per resourceId: ${resourceId}`);
        return;
      }
      
      // Ottieni le impostazioni del calendario
      const settings = await this.getCalendarSettings();
      if (!settings || !settings.selectedCalendarId) {
        this.log('error', 'Impossibile gestire evento: nessun calendario selezionato');
        throw new Error('Nessun calendario selezionato');
      }
      
      // Ottieni gli eventi aggiornati dal calendario
      const calendar = this.getCalendar();
      if (!calendar) {
        throw new Error('Client Google Calendar non inizializzato');
      }
      
      // Ottieni gli eventi modificati recentemente
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000); // 5 minuti fa
      
      const response = await calendar.events.list({
        calendarId: settings.selectedCalendarId,
        updatedMin: fiveMinutesAgo.toISOString(),
        singleEvents: true,
        orderBy: 'updated'
      });
      
      if (!response.data.items || response.data.items.length === 0) {
        this.log('info', 'Nessun evento aggiornato trovato');
        return;
      }
      
      this.log('info', `Trovati ${response.data.items.length} eventi aggiornati`);
      
      // Processa ogni evento
      for (const event of response.data.items) {
        await this.processCalendarEventInternal(event);
      }
    } catch (error) {
      this.log('error', 'Errore durante la gestione dell\'evento', error);
      throw error;
    }
  }
  
  /**
   * Processa un singolo evento di Google Calendar
   * @param event - Evento di Google Calendar
   */
  protected override async processCalendarEventInternal(event: calendar_v3.Schema$Event): Promise<void> {
    if (!event.id) {
      this.log('warn', 'Evento senza ID, impossibile processare');
      return;
    }
    
    this.log('info', `Processamento evento: ${event.id} - ${event.summary}`);
    
    const db = getDatabase();
    if (!db) {
      throw new Error('Database non disponibile');
    }
    
    // Verifica se l'evento è già associato a un appuntamento
    const existingAppointment = db.prepare('SELECT * FROM appointments WHERE google_calendar_event_id = ?').get(event.id) as { id: number } | undefined;
    
    if (existingAppointment) {
      // Aggiorna l'appuntamento esistente
      await this.updateAppointmentFromEvent(existingAppointment.id, event);
      
      // Crea una notifica per l'aggiornamento dell'appuntamento
      try {
        // Ottieni i dettagli dell'appuntamento aggiornato
        const updatedAppointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(existingAppointment.id) as Appointment;
        
        if (updatedAppointment && updatedAppointment.patient_id) {
          // Crea una notifica per l'aggiornamento dell'appuntamento
          await this.createNotificationForAppointment(updatedAppointment.id, updatedAppointment.patient_id, 'update');
        }
      } catch (notificationError) {
        this.log('error', `Errore nella creazione della notifica per l'aggiornamento dell'appuntamento: ${notificationError}`);
        // Non blocchiamo l'aggiornamento dell'appuntamento se la creazione della notifica fallisce
      }
    } else {
      // Verifica se l'evento è stato creato tramite la funzionalità di prenotazione
      const isBooking = this.isBookingEvent(event);
      
      if (isBooking) {
        this.log('info', `Evento ${event.id} rilevato come prenotazione tramite link`);
        // Gestisci l'evento come una prenotazione
        await this.processBookingEvent(event);
      } else {
        // Crea un nuovo appuntamento normalmente
        await this.createAppointmentFromEventInternal(event);
      }
    }
  }
  
  /**
   * Processa un evento creato tramite la funzionalità di prenotazione di Google Calendar
   * @param event - Evento di Google Calendar
   */
  private async processBookingEvent(event: calendar_v3.Schema$Event): Promise<void> {
    this.log('info', `Processamento evento di prenotazione: ${event.id} - ${event.summary}`);
    
    try {
      // Estrai i dati dell'utente dall'evento
      const userData = this.extractUserDataFromBookingEvent(event);
      
      // Crea un nuovo utente o trova un utente esistente
      const userId = await this.createUserFromBookingData(userData);
      
      // Estrai i dati dell'appuntamento dall'evento
      const eventData = this.extractEventData(event);
      
      const db = getDatabase();
      if (!db) {
        throw new Error('Database non disponibile');
      }
      
      // Crea l'appuntamento nel database
      const result = db.prepare(`
        INSERT INTO appointments (
          title, 
          patient_id, 
          date, 
          time, 
          duration, 
          notes, 
          status, 
          google_calendar_event_id, 
          synced, 
          created_at, 
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        eventData.title,
        userId,
        eventData.date,
        eventData.time,
        eventData.duration,
        eventData.notes + '\n\nCreato tramite link di prenotazione.',
        eventData.status,
        event.id
      );
      
      this.log('info', `Nuovo appuntamento creato da prenotazione con ID: ${result.lastInsertRowid}`);
    } catch (error) {
      this.log('error', 'Errore durante la creazione dell\'appuntamento da prenotazione', error);
      throw error;
    }
  }
  
  /**
   * Crea un nuovo appuntamento dai dati di un evento di Google Calendar
   * Implementazione specifica per questa classe derivata
   * @param event - Evento di Google Calendar
   * @returns Oggetto Appointment
   */
  private createAppointmentFromEventOverride(event: calendar_v3.Schema$Event): Promise<Appointment> {
    if (!event.start) {
      throw new Error('Evento senza data di inizio');
    }
    
    // Estrai il nome del paziente dal titolo dell'evento, rimuovendo prefissi comuni
    let patientName = event.summary || '';
    const prefixes = ['Appuntamento:', 'Appuntamento con:', 'Visita:', 'Paziente:'];
    for (const prefix of prefixes) {
      if (patientName.toLowerCase().startsWith(prefix.toLowerCase())) {
        patientName = patientName.substring(prefix.length).trim();
        break;
      }
    }

    this.log('info', `Nome del paziente estratto dall'evento: ${patientName}`);
    
    // Rimuovi eventuali email dal nome del paziente
    patientName = patientName.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '');
    
    // Rimuovi eventuali numeri di telefono dal nome del paziente
    patientName = patientName.replace(/\b\d{6,}\b/g, '');
    
    // Rimuovi eventuali spazi multipli risultanti
    patientName = patientName.replace(/\s+/g, ' ').trim();
    
    // Crea le date di inizio e fine con il fuso orario corretto
    const startDate = new Date(event.start.dateTime || event.start.date || new Date());
    const endDate = new Date(event.end?.dateTime || event.end?.date || new Date());
    
    this.log('info', `Creazione appuntamento da evento: ${patientName}, inizio: ${startDate.toString()}, fine: ${endDate.toString()}`);
    
    return Promise.resolve({
      id: 0, // ID temporaneo, verrà assegnato dal database
      patient_name: patientName,
      notes: '', // Note vuote come richiesto
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      google_calendar_event_id: event.id || null,
      synced: 1
    });
  }
  
  /**
   * Aggiorna un appuntamento esistente con i dati di un evento di Google Calendar
   * Sovrascrive il metodo della classe base
   * @param appointmentId - ID dell'appuntamento da aggiornare
   * @param event - Evento di Google Calendar
   */
  protected async updateAppointmentFromEvent(appointmentId: number, event: calendar_v3.Schema$Event): Promise<void> {
    this.log('info', `Aggiornamento appuntamento ${appointmentId} da evento Google Calendar`);
    
    try {
      const db = getDatabase();
      if (!db) {
        throw new Error('Database non disponibile');
      }
      
      // Estrai i dati dall'evento
      const eventData = this.extractEventData(event);
      
      // Aggiorna l'appuntamento nel database
      db.prepare(`
        UPDATE appointments SET 
        title = ?, 
        date = ?, 
        time = ?, 
        duration = ?, 
        notes = ?, 
        status = ?, 
        updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(
        eventData.title,
        eventData.date,
        eventData.time,
        eventData.duration,
        eventData.notes,
        eventData.status,
        appointmentId
      );
      
      this.log('info', `Appuntamento ${appointmentId} aggiornato con successo`);
    } catch (error) {
      this.log('error', `Errore durante l'aggiornamento dell'appuntamento ${appointmentId}`, error);
      throw error;
    }
  }
  
  /**
   * Crea un nuovo appuntamento dai dati di un evento di Google Calendar
   * @param event - Evento di Google Calendar
   */
  private async createAppointmentFromEventInternal(event: calendar_v3.Schema$Event): Promise<void> {
    this.log('info', `Creazione nuovo appuntamento da evento Google Calendar: ${event.summary}`);
    
    try {
      const db = getDatabase();
      if (!db) {
        throw new Error('Database non disponibile');
      }
      
      // Cerca di identificare il paziente con diversi metodi
      let patientId: number | null = null;
      
      // 1. Prima prova a estrarre l'ID dalla descrizione (per retrocompatibilità)
      patientId = this.extractPatientIdFromDescription(event.description, event.summary);
      
      // 2. Se non è stato trovato un ID, cerca di trovare il paziente per nome dal titolo dell'evento
      if (!patientId && event.summary) {
        // Estrai il possibile nome del paziente dal titolo
        // Assumiamo che il titolo possa contenere il nome del paziente
        const possiblePatientName = event.summary;
        patientId = this.findPatientByName(possiblePatientName);
        
        if (patientId) {
          this.log('info', `Trovato paziente dal titolo dell'evento: ${patientId}`);
        }
      }
      
      // 3. Se ancora non è stato trovato, cerca nella descrizione
      if (!patientId && event.description) {
        // Cerca di estrarre il nome del paziente dalla descrizione
        // Cerca pattern come "Paziente: Nome Cognome" o "Paziente: Cognome Nome"
        const patientNameMatch = event.description.match(/paziente\s*:\s*([^\n]+)/i);
        
        if (patientNameMatch && patientNameMatch[1]) {
          const possiblePatientName = patientNameMatch[1].trim();
          patientId = this.findPatientByName(possiblePatientName);
          
          if (patientId) {
            this.log('info', `Trovato paziente dalla descrizione dell'evento: ${patientId}`);
          }
        }
      }
      
      // 4. Se ancora non è stato trovato, usa il primo paziente disponibile
      if (!patientId) {
        const firstPatient = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: number } | undefined;
        if (firstPatient) {
          patientId = firstPatient.id;
          this.log('warn', `Nessun paziente identificato nell'evento, usando il primo paziente disponibile: ${patientId}`);
        } else {
          this.log('error', 'Impossibile creare appuntamento: nessun paziente disponibile');
          throw new Error('Nessun paziente disponibile');
        }
      }
      
      // Ottieni il nome e cognome del paziente per il titolo dell'appuntamento
      let title = '';
      const patient = db.prepare('SELECT first_name, last_name, phone FROM users WHERE id = ?').get(patientId) as 
        { first_name: string, last_name: string, phone: string } | undefined;
      
      if (patient) {
        // Usa nome e cognome del paziente come titolo dell'appuntamento
        title = `${patient.first_name} ${patient.last_name}`;
        this.log('info', `Titolo dell'appuntamento impostato con nome e cognome del paziente: ${title}`);
      } else {
        // Se non è stato possibile ottenere il nome del paziente, usa il titolo dell'evento
        title = event.summary || 'Appuntamento';
      }
      
      // Estrai data e ora con correzione del fuso orario
      let date = '';
      let time = '';
      let duration = 30; // Durata predefinita in minuti
      
      if (event.start?.dateTime) {
        const startDate = new Date(event.start.dateTime);
        
        // Formatta la data nel formato YYYY-MM-DD
        date = startDate.toISOString().split('T')[0];
        
        // Formatta l'ora nel formato HH:MM, considerando il fuso orario locale
        // Questo risolve il problema dello sfasamento di 2 ore
        const hours = startDate.getHours().toString().padStart(2, '0');
        const minutes = startDate.getMinutes().toString().padStart(2, '0');
        time = `${hours}:${minutes}`;
        
        // Calcola la durata se è disponibile l'ora di fine
        if (event.end?.dateTime) {
          const endDate = new Date(event.end.dateTime);
          // Calcola la durata in minuti sottraendo l'orario di inizio dall'orario di fine
          duration = Math.round((endDate.getTime() - startDate.getTime()) / 60000); // Durata in minuti
          this.log('info', `Durata calcolata dall'evento: ${duration} minuti (da ${startDate.toISOString()} a ${endDate.toISOString()})`);
        } else {
          this.log('warn', 'Orario di fine non disponibile, utilizzo durata predefinita di 30 minuti');
        }
      } else if (event.start?.date) {
        // Evento che dura tutto il giorno
        date = event.start.date;
        time = '09:00'; // Ora predefinita
        duration = 60; // Durata predefinita per eventi giornalieri
        this.log('info', `Evento giornaliero, utilizzo durata predefinita di ${duration} minuti`);
      }
      
      // Determina lo stato
      let status = 'scheduled';
      if (event.status === 'cancelled') {
        status = 'cancelled';
      }
      
      // Crea l'appuntamento nel database
      const result = db.prepare(`
        INSERT INTO appointments (
          title, 
          patient_id, 
          date, 
          time, 
          duration, 
          notes, 
          status, 
          google_calendar_event_id, 
          synced, 
          created_at, 
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        title,
        patientId,
        date,
        time,
        duration,
        '', // Note vuote per gli appuntamenti importati da Google Calendar (come richiesto)
        status,
        event.id
      );
      
      const appointmentId = (result as { lastInsertRowid: number }).lastInsertRowid;
      this.log('info', `Nuovo appuntamento creato con ID: ${appointmentId}`);
      
      // Crea una notifica per l'appuntamento importato da Google Calendar
      if (patientId && patient) {
        try {
          // Ottieni il template per le notifiche di Google Calendar
          const template = db.prepare(`
            SELECT * FROM notification_templates 
            WHERE type = 'google_calendar_confirmation' AND is_system = 1
            LIMIT 1
          `).get() as { id: number, content: string };
          
          if (template) {
            // Ottieni le impostazioni generali per il nome dell'azienda
            const generalSettings = db.prepare('SELECT * FROM app_settings WHERE key = ?').get('general') as { value: string } | undefined;
            let clinicName = 'SlabsLink';
            
            if (generalSettings) {
              try {
                const settings = JSON.parse(generalSettings.value);
                if (settings && settings.clinicName) {
                  clinicName = settings.clinicName;
                }
              } catch (error) {
                this.log('error', 'Errore nel parsing delle impostazioni generali', error);
              }
            }
            
            // Sostituisci i placeholder nel template
            let message = template.content
              .replace(/\{\{first_name\}\}|\{first_name\}/g, patient.first_name || '')
              .replace(/\{\{last_name\}\}|\{last_name\}/g, patient.last_name || '')
              .replace(/\{\{appointment_date\}\}|\{appointment_date\}/g, date)
              .replace(/\{\{appointment_time\}\}|\{appointment_time\}/g, time)
              .replace(/\{\{clinic_name\}\}|\{clinic_name\}/g, clinicName)
              .replace(/SlabsLink/g, clinicName); // Retrocompatibilità
            
            // Inserisci la notifica
            const notificationInsert = db.prepare(`
              INSERT INTO notifications (
                user_id, message, status, template_id, appointment_id, phone, created_at, updated_at
              ) VALUES (?, ?, 'pending', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `);
            
            const notificationResult = notificationInsert.run(
              patientId,
              message,
              template.id,
              appointmentId,
              patient.phone || null
            );
            
            // Ottieni l'ID della notifica appena creata
            const notificationId = notificationResult.lastInsertRowid;
            
            this.log('info', `Notifica ID ${notificationId} creata per l'appuntamento importato da Google Calendar per l'utente ${patientId}`);
          } else {
            this.log('warn', 'Template per notifiche Google Calendar non trovato');
          }
        } catch (notificationError) {
          this.log('error', `Errore nella creazione della notifica per l'appuntamento importato da Google Calendar: ${notificationError}`);
          // Non blocchiamo la creazione dell'appuntamento se la creazione della notifica fallisce
        }
      }
    } catch (error) {
      this.log('error', 'Errore durante la creazione dell\'appuntamento', error);
      throw error;
    }
  }
  
  /**
   * Estrae i dati rilevanti da un evento di Google Calendar
   * @param event - Evento di Google Calendar
   * @returns Dati dell'appuntamento
   */
  private extractEventData(event: calendar_v3.Schema$Event): {
    title: string;
    date: string;
    time: string;
    duration: number;
    notes: string;
    status: string;
  } {
    // Estrai il titolo - Per gli eventi importati da Google Calendar, usiamo SOLO nome e cognome del paziente
    let title = '';
    
    // Cerca di ottenere il nome del paziente dal database se possibile
    const patientId = this.extractPatientIdFromDescription(event.description, event.summary) || 
                      (event.summary ? this.findPatientByName(event.summary) : null);
    
    if (patientId) {
      const db = getDatabase();
      if (db) {
        const patient = db.prepare('SELECT first_name, last_name FROM users WHERE id = ?').get(patientId) as 
          { first_name: string, last_name: string } | undefined;
        
        if (patient) {
          // Usa SOLO nome e cognome del paziente come titolo dell'appuntamento
          title = `${patient.first_name} ${patient.last_name}`;
          this.log('info', `Titolo dell'appuntamento impostato con nome e cognome del paziente: ${title}`);
        }
      }
    }
    
    // Se non è stato possibile ottenere il nome del paziente, pulisci il titolo dell'evento
    if (!title) {
      title = event.summary || 'Appuntamento';
      
      // Rimuovi prefissi comuni
      const prefixes = ['Appuntamento:', 'Appuntamento con:', 'Visita:', 'Paziente:'];
      for (const prefix of prefixes) {
        if (title.toLowerCase().startsWith(prefix.toLowerCase())) {
          title = title.substring(prefix.length).trim();
          break;
        }
      }
      
      // Rimuovi eventuali email dal titolo
      title = title.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '');
      
      // Rimuovi eventuali numeri di telefono dal titolo (pattern semplificato)
      title = title.replace(/\b\d{6,}\b/g, '');
      
      // Rimuovi eventuali spazi multipli risultanti
      title = title.replace(/\s+/g, ' ').trim();
    }
    
    // Estrai data e ora con correzione del fuso orario
    let date = '';
    let time = '';
    let duration = 30; // Durata predefinita in minuti
    
    if (event.start?.dateTime) {
      // Crea una data con il fuso orario corretto
      const startDate = new Date(event.start.dateTime);
      
      // Formatta la data nel formato YYYY-MM-DD
      date = startDate.toISOString().split('T')[0];
      
      // Formatta l'ora nel formato HH:MM, considerando il fuso orario locale
      // Correzione del problema del fuso orario (2 ore di differenza)
      // Utilizziamo getHours() che restituisce l'ora nel fuso orario locale
      const hours = startDate.getHours().toString().padStart(2, '0');
      const minutes = startDate.getMinutes().toString().padStart(2, '0');
      time = `${hours}:${minutes}`;
      
      this.log('info', `Orario estratto: ${time} (da ${startDate.toISOString()}, ora locale: ${startDate.toString()})`);
      
      // Calcola la durata se è disponibile l'ora di fine
      if (event.end?.dateTime) {
        const endDate = new Date(event.end.dateTime);
        // Calcola la durata in minuti sottraendo l'orario di inizio dall'orario di fine
        duration = Math.round((endDate.getTime() - startDate.getTime()) / 60000); // Durata in minuti
        this.log('info', `Durata calcolata dall'evento: ${duration} minuti (da ${startDate.toISOString()} a ${endDate.toISOString()})`);
      } else {
        this.log('warn', 'Orario di fine non disponibile, utilizzo durata predefinita di 30 minuti');
      }
    } else if (event.start?.date) {
      // Evento che dura tutto il giorno
      date = event.start.date;
      time = '09:00'; // Ora predefinita
      duration = 60; // Durata predefinita per eventi giornalieri
      this.log('info', `Evento giornaliero, utilizzo durata predefinita di ${duration} minuti`);
    }
    
    // Per gli appuntamenti importati da Google Calendar, lasciamo le note vuote
    // come richiesto dall'utente - non riportiamo le note dell'evento
    const notes = '';
    
    // Determina lo stato
    let status = 'scheduled';
    if (event.status === 'cancelled') {
      status = 'cancelled';
    }
    
    return {
      title,
      date,
      time,
      duration,
      notes,
      status
    };
  }
  
  /**
   * Estrae l'ID del paziente dalla descrizione o dal titolo dell'evento
   * @param description - Descrizione dell'evento
   * @param title - Titolo dell'evento
   * @returns ID del paziente o null se non trovato
   */
  private extractPatientIdFromDescription(description?: string | null, title?: string | null): number | null {
    // Prima verifica se c'è un ID esplicito nella descrizione (per retrocompatibilità)
    if (description) {
      // Cerca un pattern come "Paziente ID: 123" o "ID paziente: 123"
      const patientIdMatch = description.match(/paziente\s*id\s*:\s*(\d+)/i) || 
                            description.match(/id\s*paziente\s*:\s*(\d+)/i);
      
      if (patientIdMatch && patientIdMatch[1]) {
        return parseInt(patientIdMatch[1], 10);
      }
    }
    
    return null;
  }
  
  /**
   * Cerca un paziente nel database in base al nome
   * @param patientName - Nome del paziente da cercare
   * @returns ID del paziente o null se non trovato
   */
  private findPatientByName(patientName?: string | null): number | null {
    if (!patientName) return null;
    
    const db = getDatabase();
    if (!db) return null;
    
    this.log('info', `Ricerca paziente per nome: "${patientName}"`);
    
    // Rimuovi eventuali prefissi comuni dal nome del paziente
    let cleanedName = patientName.trim();
    const prefixes = ['Appuntamento:', 'Appuntamento con:', 'Visita:', 'Paziente:'];
    for (const prefix of prefixes) {
      if (cleanedName.toLowerCase().startsWith(prefix.toLowerCase())) {
        cleanedName = cleanedName.substring(prefix.length).trim();
        break;
      }
    }
    
    // Normalizza il nome del paziente
    const normalizedName = cleanedName.toLowerCase();
    this.log('info', `Nome paziente normalizzato: "${normalizedName}"`);
    
    // Cerca corrispondenze esatte
    const exactMatch = db.prepare(
      'SELECT id FROM users WHERE LOWER(first_name || " " || last_name) = ? OR LOWER(last_name || " " || first_name) = ?'
    ).get(normalizedName, normalizedName) as { id: number } | undefined;
    
    if (exactMatch) {
      this.log('info', `Trovato paziente con corrispondenza esatta: ${exactMatch.id}`);
      return exactMatch.id;
    }
    
    // Dividi il nome in parti per cercare corrispondenze più flessibili
    const nameParts = normalizedName.split(' ').filter(part => part.length > 0);
    
    if (nameParts.length >= 2) {
      // Prova a cercare corrispondenze con first_name e last_name separatamente
      const firstNameMatch = db.prepare(
        'SELECT id FROM users WHERE LOWER(first_name) = ? AND LOWER(last_name) = ?'
      ).get(nameParts[0], nameParts[1]) as { id: number } | undefined;
      
      if (firstNameMatch) {
        this.log('info', `Trovato paziente con corrispondenza su first_name e last_name: ${firstNameMatch.id}`);
        return firstNameMatch.id;
      }
      
      // Prova con l'ordine inverso (cognome, nome)
      const lastNameMatch = db.prepare(
        'SELECT id FROM users WHERE LOWER(first_name) = ? AND LOWER(last_name) = ?'
      ).get(nameParts[1], nameParts[0]) as { id: number } | undefined;
      
      if (lastNameMatch) {
        this.log('info', `Trovato paziente con corrispondenza su last_name e first_name: ${lastNameMatch.id}`);
        return lastNameMatch.id;
      }
    }
    
    // Cerca corrispondenze parziali
    const partialMatches = db.prepare(
      'SELECT id, first_name, last_name FROM users WHERE ' +
      'LOWER(first_name || " " || last_name) LIKE ? OR ' +
      'LOWER(last_name || " " || first_name) LIKE ?'
    ).all(`%${normalizedName}%`, `%${normalizedName}%`) as Array<{ id: number, first_name: string, last_name: string }>;
    
    if (partialMatches && partialMatches.length > 0) {
      // Se c'è solo una corrispondenza parziale, usala
      if (partialMatches.length === 1) {
        this.log('info', `Trovato paziente con corrispondenza parziale: ${partialMatches[0].id} (${partialMatches[0].first_name} ${partialMatches[0].last_name})`);
        return partialMatches[0].id;
      }
      
      // Se ci sono più corrispondenze, cerca di trovare la migliore
      // Implementazione migliorata: cerca la corrispondenza più probabile
      let bestMatch = partialMatches[0];
      let bestScore = 0;
      
      for (const match of partialMatches) {
        const fullName = `${match.first_name} ${match.last_name}`.toLowerCase();
        const reverseName = `${match.last_name} ${match.first_name}`.toLowerCase();
        
        // Calcola un punteggio semplice basato sulla somiglianza
        let score = 0;
        
        if (fullName.includes(normalizedName) || normalizedName.includes(fullName)) {
          score += 2;
        }
        
        if (reverseName.includes(normalizedName) || normalizedName.includes(reverseName)) {
          score += 2;
        }
        
        // Controlla se le parti del nome corrispondono
        for (const part of nameParts) {
          if (match.first_name.toLowerCase().includes(part) || match.last_name.toLowerCase().includes(part)) {
            score += 1;
          }
        }
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = match;
        }
      }
      
      this.log('info', `Trovata migliore corrispondenza parziale: ${bestMatch.id} (${bestMatch.first_name} ${bestMatch.last_name}) con punteggio ${bestScore}`);
      return bestMatch.id;
    }
    
    this.log('warn', `Nessun paziente trovato per il nome: "${patientName}"`);
    return null;
  }
}