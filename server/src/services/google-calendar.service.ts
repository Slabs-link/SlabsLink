import { OAuth2Client } from 'google-auth-library';
import type { Response } from 'express';
import { google, calendar_v3 } from 'googleapis';
import { getDatabase } from '../config/database-sqlite';
import type { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { AppSetting, CalendarSettings } from '../interfaces/app-setting.interface';
import { Appointment } from '../interfaces/appointment.interface';

export class GoogleCalendarService {
  private db!: Database;
  private oauth2Client: OAuth2Client | null = null;
  private calendar: calendar_v3.Calendar | null = null;
  private webhookUrl: string | null = null;
  private notificationChannel: string | null = '';
  
  /**
   * Getter protetto per accedere al calendario
   * Utilizzato dalle classi che estendono GoogleCalendarService
   */
  protected getCalendar(): calendar_v3.Calendar | null {
    return this.calendar;
  }

  constructor() {}

  /**
   * Funzione di logging per Google Calendar
   * @param level - Livello di log (info, warn, error)
   * @param message - Messaggio da loggare
   * @param data - Dati aggiuntivi opzionali
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
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
   * Recupera le impostazioni del calendario dal database
   */
  protected async getCalendarSettings(): Promise<CalendarSettings | null> {
    try {
      this.log('info', 'Recupero delle impostazioni del calendario dal database');
      this.db = getDatabase();
      
      if (!this.db) {
        this.log('error', 'Impossibile ottenere la connessione al database');
        return null;
      }
      
      // Verifica se la tabella app_settings esiste
      this.log('info', 'Verifica esistenza tabella app_settings');
      const tableExists = this.db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='app_settings'`
      ).get();
      
      if (!tableExists) {
        this.log('warn', 'Tabella app_settings non trovata nel database');
        return null;
      }
      
      // Ottieni le impostazioni del calendario
      this.log('info', 'Ricerca impostazioni del calendario nella tabella app_settings');
      const setting = this.db.prepare(
        'SELECT * FROM app_settings WHERE key = ?'
      ).get('calendar') as AppSetting | undefined;
      
      if (!setting) {
        this.log('warn', 'Impostazioni del calendario non trovate nel database');
        return null;
      }
      
      this.log('info', 'Impostazioni del calendario trovate nel database', {
        hasValue: !!setting.value,
        valueLength: setting.value ? setting.value.length : 0,
        updatedAt: setting.updated_at
      });
      
      try {
        if (!setting.value) {
          this.log('warn', 'Il valore delle impostazioni del calendario è vuoto');
          return null;
        }
        
        const calendarSettings = JSON.parse(setting.value);
        
        this.log('info', 'Parsing delle impostazioni del calendario completato', {
          googleCalendarEnabled: calendarSettings.googleCalendarEnabled,
          hasClientId: !!calendarSettings.clientId,
          hasClientSecret: !!calendarSettings.clientSecret,
          hasRedirectUri: !!calendarSettings.redirectUri,
          hasTokens: !!calendarSettings.tokens,
          hasAccessToken: !!calendarSettings.tokens?.access_token,
          hasRefreshToken: !!calendarSettings.tokens?.refresh_token,
          hasSelectedCalendarId: !!calendarSettings.selectedCalendarId
        });
        
        return calendarSettings;
      } catch (error) {
        this.log('error', 'Errore nel parsing delle impostazioni del calendario', error);
        this.log('error', 'Valore grezzo delle impostazioni:', { rawValue: setting.value.substring(0, 100) + '...' });
        return null;
      }
    } catch (error) {
      // Gestisci specificamente l'errore di database non inizializzato
      if (error instanceof Error && error.message.includes('Database non inizializzato')) {
        this.log('error', 'Database non inizializzato durante il recupero delle impostazioni del calendario');
      } else {
        this.log('error', 'Errore durante il recupero delle impostazioni del calendario', error);
      }
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
    try {
      this.log('info', 'Verifica autenticazione del servizio Google Calendar');
      
      // Ottieni le impostazioni del calendario
      const settings = await this.getCalendarSettings();
      this.log('info', 'Impostazioni del calendario recuperate', {
        hasSettings: !!settings,
        hasTokens: !!settings?.tokens,
        googleCalendarEnabled: settings?.googleCalendarEnabled
      });
      
      // Verifica se ci sono token nelle impostazioni
      if (!settings?.tokens) {
        this.log('info', 'Servizio Google Calendar non autenticato: token mancanti');
        return false;
      }
      
      // Verifica che i token contengano i campi necessari
      if (!settings.tokens.access_token) {
        this.log('error', 'Token di accesso mancante nelle impostazioni');
        return false;
      }
      
      // Log dettagliato dei token (senza esporre informazioni sensibili)
      this.log('info', 'Token trovati nelle impostazioni', {
        hasAccessToken: !!settings.tokens.access_token,
        accessTokenLength: settings.tokens.access_token ? settings.tokens.access_token.length : 0,
        hasRefreshToken: !!settings.tokens.refresh_token,
        refreshTokenLength: settings.tokens.refresh_token ? settings.tokens.refresh_token.length : 0,
        tokenType: settings.tokens.token_type,
        hasExpiryDate: !!settings.tokens.expiry_date,
        expiryDate: settings.tokens.expiry_date ? new Date(settings.tokens.expiry_date).toISOString() : 'N/A'
      });
      
      // Verifica se il token è scaduto
      if (settings.tokens.expiry_date) {
        const expiryDate = new Date(settings.tokens.expiry_date);
        const now = new Date();
        if (expiryDate <= now) {
          this.log('warn', 'Token di accesso scaduto', {
            expiryDate: expiryDate.toISOString(),
            currentDate: now.toISOString()
          });
          
          // Se abbiamo un refresh token, possiamo provare a rinnovare il token
          if (settings.tokens.refresh_token) {
            this.log('info', 'Tentativo di rinnovo del token usando il refresh token');
            try {
              // Configura il client OAuth2 se non è già configurato
              if (!this.oauth2Client) {
                await this.configure();
              }
              
              if (!this.oauth2Client) {
                this.log('error', 'Impossibile configurare il client OAuth2 per il rinnovo del token');
                return false;
              }
              
              // Imposta solo il refresh token
              this.oauth2Client.setCredentials({
                refresh_token: settings.tokens.refresh_token
              });
              
              // Richiedi un nuovo token di accesso
              const { credentials } = await this.oauth2Client.refreshAccessToken();
              this.log('info', 'Token di accesso rinnovato con successo', {
                hasNewAccessToken: !!credentials.access_token,
                hasNewRefreshToken: !!credentials.refresh_token,
                newExpiryDate: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : 'N/A'
              });
              
              // Aggiorna i token nelle impostazioni
              // Assicuriamoci che credentials.access_token sia definito
              if (credentials.access_token) {
                settings.tokens = {
                  access_token: credentials.access_token,
                  refresh_token: credentials.refresh_token || undefined,
                  expiry_date: credentials.expiry_date || undefined,
                  token_type: credentials.token_type || undefined,
                  id_token: credentials.id_token || undefined,
                  scope: credentials.scope || undefined
                };
              } else {
                this.log('error', 'Token di accesso mancante nelle credenziali rinnovate');
                return false;
              }
              
              // Salva i nuovi token nel database
              this.db = getDatabase();
              if (this.db) {
                const jsonSettings = JSON.stringify(settings);
                const updateResult = this.db.prepare('UPDATE app_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?')
                  .run(jsonSettings, 'calendar');
                
                this.log('info', 'Token rinnovati salvati nel database', {
                  changes: updateResult.changes
                });
              } else {
                this.log('error', 'Impossibile salvare i token rinnovati: database non disponibile');
              }
            } catch (refreshError) {
              this.log('error', 'Errore durante il rinnovo del token', refreshError);
              return false;
            }
          } else {
            this.log('warn', 'Token scaduto e nessun refresh token disponibile, riautenticazione necessaria');
            return false;
          }
        }
      }
      
      // Configura il client OAuth2 se non è già configurato
      if (!this.oauth2Client) {
        this.log('info', 'Client OAuth2 non inizializzato, tentativo di configurazione');
        await this.configure();
      }
      
      // Verifica se il client è stato configurato correttamente
      if (!this.oauth2Client) {
        this.log('error', 'Servizio Google Calendar non autenticato: client OAuth2 non configurato');
        return false;
      }
      
      // Imposta i token nel client OAuth2
      this.log('info', 'Impostazione dei token nel client OAuth2');
      // Verifica che settings.tokens sia definito prima di passarlo a setCredentials
      if (settings.tokens && settings.tokens.access_token) {
        this.oauth2Client.setCredentials({
          access_token: settings.tokens.access_token,
          refresh_token: settings.tokens.refresh_token,
          expiry_date: settings.tokens.expiry_date,
          token_type: settings.tokens.token_type,
          id_token: settings.tokens.id_token,
          scope: settings.tokens.scope
        });
      } else {
        this.log('error', 'Token non validi o mancanti');
        return false;
      }
      
      // Inizializza il client Google Calendar
      this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      
      // Verifica che il client sia stato inizializzato correttamente
      if (!this.calendar) {
        this.log('error', 'Client Google Calendar non inizializzato correttamente');
        return false;
      }
      
      // Verifica che i token siano validi facendo una richiesta di test
      try {
        this.log('info', 'Verifica validità dei token con una richiesta di test');
        // Richiesta leggera per verificare l'autenticazione
        await this.calendar.calendarList.list({ maxResults: 1 });
        this.log('info', 'Richiesta di test completata con successo, token validi');
      } catch (apiError) {
        this.log('error', 'Errore durante la verifica dei token con richiesta di test', apiError);
        
        // Analisi dettagliata dell'errore
        if (apiError instanceof Error) {
          const errorMessage = apiError.message;
          
          // Gestione specifica dei diversi tipi di errori
          if (errorMessage.includes('invalid_grant')) {
            this.log('warn', 'Token non validi o scaduti, potrebbe essere necessario riautenticare');
          } else if (errorMessage.includes('invalid_token')) {
            this.log('warn', 'Token non valido, potrebbe essere necessario riautenticare');
          } else if (errorMessage.includes('unauthorized_client')) {
            this.log('error', 'Client non autorizzato, verificare le credenziali dell\'applicazione');
          } else if (errorMessage.includes('access_denied')) {
            this.log('error', 'Accesso negato, verificare le autorizzazioni dell\'applicazione');
          } else {
            this.log('error', `Errore API non riconosciuto: ${errorMessage}`);
          }
        }
        
        return false;
      }
      
      this.log('info', 'Servizio Google Calendar autenticato con successo');
      return true;
    } catch (error) {
      this.log('error', 'Errore durante la verifica dell\'autenticazione', error);
      return false;
    }
  }

  /**
   * Configura il client OAuth2
   */
  async configure(): Promise<void> {
    this.log('info', 'Configurazione del servizio Google Calendar');
    
    try {
      this.db = getDatabase();
      
      // Verifica se la tabella app_settings esiste
      const tableExists = this.db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='app_settings'`
      ).get();
      
      if (!tableExists) {
        this.log('error', 'Tabella app_settings non trovata nel database');
        throw new Error('Tabella app_settings non trovata nel database');
      }
      
      const setting = this.db.prepare(
        'SELECT * FROM app_settings WHERE key = ?'
      ).get('calendar') as AppSetting | undefined;
      
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
        
        if (calendarSettings.tokens && calendarSettings.tokens.access_token) {
          this.oauth2Client.setCredentials({
            access_token: calendarSettings.tokens.access_token,
            refresh_token: calendarSettings.tokens.refresh_token,
            expiry_date: calendarSettings.tokens.expiry_date,
            token_type: calendarSettings.tokens.token_type,
            id_token: calendarSettings.tokens.id_token,
            scope: calendarSettings.tokens.scope
          });
          this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
          this.log('info', 'Token OAuth2 impostati e client Google Calendar inizializzato');
        } else {
          this.log('warn', 'Token OAuth2 mancanti o non validi, autenticazione richiesta');
        }
      } catch (parseError) {
        this.log('error', 'Errore nel parsing delle impostazioni di Google Calendar', parseError);
        throw new Error('Errore nel parsing delle impostazioni di Google Calendar');
      }
    } catch (error) {
      // Gestisci specificamente l'errore di database non inizializzato
      if (error instanceof Error && error.message.includes('Database non inizializzato')) {
        this.log('error', 'Database non inizializzato durante la configurazione di Google Calendar');
        throw new Error('Database non inizializzato');
      } else {
        this.log('error', 'Errore durante la configurazione di Google Calendar', error);
        throw error;
      }
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
    this.log('info', 'Impostazione del codice di autorizzazione');
    
    try {
      if (!this.oauth2Client) {
        this.log('info', 'Client OAuth2 non inizializzato, tentativo di configurazione');
        await this.configure();
      }
      
      if (!this.oauth2Client) {
        this.log('error', 'Google Calendar service non configurato dopo il tentativo di configurazione');
        throw new Error('Google Calendar service non configurato');
      }

      // Verifica che il codice non sia vuoto o malformato
      if (!code || typeof code !== 'string' || code.trim() === '') {
        this.log('error', 'Codice di autorizzazione invalido o vuoto');
        throw new Error('Codice di autorizzazione invalido');
      }

      this.log('info', `Scambio del codice di autorizzazione: ${code.substring(0, 10)}...`);
      
      // Ottieni i token usando il codice di autorizzazione
      const { tokens } = await this.oauth2Client.getToken(code);
      
      // Verifica che i token siano stati ottenuti correttamente
      if (!tokens || !tokens.access_token) {
        this.log('error', 'Token OAuth2 non ottenuti o incompleti');
        throw new Error('Token OAuth2 non ottenuti correttamente');
      }
      
      this.log('info', 'Token OAuth2 ottenuti con successo', { 
        hasAccessToken: !!tokens.access_token,
        accessTokenLength: tokens.access_token ? tokens.access_token.length : 0,
        hasRefreshToken: !!tokens.refresh_token,
        refreshTokenLength: tokens.refresh_token ? tokens.refresh_token.length : 0,
        tokenType: tokens.token_type,
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : 'N/A'
      });
      
      // Imposta i token nel client OAuth2
      // Verifica che tokens.access_token sia definito prima di passarlo a setCredentials
      if (tokens.access_token) {
        this.oauth2Client.setCredentials({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: tokens.expiry_date,
          token_type: tokens.token_type,
          id_token: tokens.id_token,
          scope: tokens.scope
        });
        this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      } else {
        this.log('error', 'Token di accesso mancante');
        throw new Error('Token di accesso mancante');
      }
      this.log('info', 'Client Google Calendar inizializzato con i nuovi token');
      
      // Verifica che i token siano validi con una richiesta di test
      try {
        this.log('info', 'Verifica validità dei token con una richiesta di test');
        // Richiesta leggera per verificare l'autenticazione
        await this.calendar.calendarList.list({ maxResults: 1 });
        this.log('info', 'Richiesta di test completata con successo, token validi');
      } catch (apiError) {
        this.log('error', 'Errore durante la verifica dei token con richiesta di test', apiError);
        throw new Error(`Token non validi: ${apiError instanceof Error ? apiError.message : 'Errore sconosciuto'}`);
      }
      
      // Salva i token nel database
      this.log('info', 'Tentativo di salvataggio dei token nel database');
      this.db = getDatabase();
      
      if (!this.db) {
        this.log('error', 'Database non disponibile');
        throw new Error('Database non disponibile');
      }
      
      // Verifica se la tabella app_settings esiste
      const tableExists = this.db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='app_settings'`
      ).get();
      
      if (!tableExists) {
        this.log('error', 'Tabella app_settings non trovata nel database');
        throw new Error('Tabella app_settings non trovata nel database');
      }
      
      const setting = this.db.prepare(
        'SELECT * FROM app_settings WHERE key = ?'
      ).get('calendar') as AppSetting | undefined;
      
      if (!setting) {
        this.log('error', 'Impostazioni di Google Calendar non trovate nel database');
        throw new Error('Impostazioni di Google Calendar non configurate');
      }
      
      this.log('info', 'Impostazioni di Google Calendar trovate nel database, parsing...');
      
      // Verifica che il valore delle impostazioni sia valido
      if (!setting.value) {
        this.log('error', 'Valore delle impostazioni vuoto o non valido');
        throw new Error('Valore delle impostazioni non valido');
      }
      
      let calendarSettings;
      try {
        calendarSettings = JSON.parse(setting.value);
      } catch (parseError) {
        this.log('error', 'Errore nel parsing delle impostazioni', parseError);
        throw new Error('Errore nel parsing delle impostazioni');
      }
      
      this.log('info', 'Impostazioni di Google Calendar parsate con successo', {
        hasClientId: !!calendarSettings.clientId,
        hasClientSecret: !!calendarSettings.clientSecret,
        hasRedirectUri: !!calendarSettings.redirectUri,
        hadTokens: !!calendarSettings.tokens
      });
      
      // Salva i token nelle impostazioni
      calendarSettings.tokens = tokens;
      
      // Assicurati che googleCalendarEnabled sia impostato a true
      calendarSettings.googleCalendarEnabled = true;
      
      // Log dettagliato dei token prima del salvataggio (senza esporre dati sensibili)
      this.log('info', 'Token da salvare nel database', {
        hasAccessToken: !!tokens.access_token,
        accessTokenLength: tokens.access_token ? tokens.access_token.length : 0,
        hasRefreshToken: !!tokens.refresh_token,
        refreshTokenLength: tokens.refresh_token ? tokens.refresh_token.length : 0,
        tokenType: tokens.token_type,
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : 'N/A'
      });
      
      // Prepara il JSON per il salvataggio
      const jsonSettings = JSON.stringify(calendarSettings);
      this.log('info', `JSON delle impostazioni generato, lunghezza: ${jsonSettings.length} caratteri`);
      
      // Salva direttamente senza transazione per semplificare
      const updateQuery = 'UPDATE app_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?';
      const updateParams = [jsonSettings, 'calendar'];
      this.log('info', `Esecuzione query di aggiornamento: ${updateQuery}`);
      
      const result = this.db.prepare(updateQuery).run(jsonSettings, 'calendar');
      this.log('info', 'Token salvati nel database', { 
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid
      });
      
      // Verifica che l'aggiornamento sia stato effettivo
      if (result.changes === 0) {
        this.log('warn', 'Nessuna riga aggiornata nel database');
        throw new Error('Nessuna riga aggiornata nel database');
      }
      
      // Verifica che i token siano stati effettivamente salvati
      const verifySettings = this.db.prepare(
        'SELECT * FROM app_settings WHERE key = ?'
      ).get('calendar') as AppSetting | undefined;
      
      if (!verifySettings) {
        this.log('warn', 'Impossibile verificare i token salvati: impostazioni non trovate');
        throw new Error('Impossibile verificare i token salvati: impostazioni non trovate');
      }
      
      try {
        const verifiedCalendarSettings = JSON.parse(verifySettings.value);
        this.log('info', 'Verifica dei token salvati', {
          tokensPresent: !!verifiedCalendarSettings.tokens,
          hasAccessToken: !!verifiedCalendarSettings.tokens?.access_token,
          accessTokenLength: verifiedCalendarSettings.tokens?.access_token?.length,
          hasRefreshToken: !!verifiedCalendarSettings.tokens?.refresh_token,
          refreshTokenLength: verifiedCalendarSettings.tokens?.refresh_token?.length,
          tokenType: verifiedCalendarSettings.tokens?.token_type,
          expiryDate: verifiedCalendarSettings.tokens?.expiry_date ? new Date(verifiedCalendarSettings.tokens.expiry_date).toISOString() : 'N/A'
        });
        
        // Verifica che i token salvati siano presenti
        if (!verifiedCalendarSettings.tokens?.access_token) {
          this.log('warn', 'I token salvati non sono presenti o sono incompleti');
          throw new Error('I token salvati non sono presenti o sono incompleti');
        }
        
        this.log('info', 'Verifica completata: i token sono stati salvati correttamente');
      } catch (parseError) {
        this.log('error', 'Errore nel parsing delle impostazioni durante la verifica', parseError);
        throw new Error('Errore nel parsing delle impostazioni durante la verifica');
      }
    } catch (error) {
      this.log('error', 'Errore durante l\'impostazione del codice di autorizzazione', error);
      throw error;
    }
  }

  /**
   * Crea un evento su Google Calendar
   */
  /**
   * Verifica se un calendario esiste e può essere utilizzato
   * @param calendarId ID del calendario da verificare
   * @returns true se il calendario esiste e può essere utilizzato, false altrimenti
   */
  private async verifyCalendarExists(calendarId: string): Promise<boolean> {
    if (!this.calendar) return false;
    
    try {
      this.log('info', `Verifica esistenza calendario con ID: ${calendarId}`);
      
      // Se è il calendario primario, assumiamo che esista sempre
      if (calendarId === 'primary') {
        this.log('info', 'Calendario primario selezionato, esistenza garantita');
        return true;
      }
      
      // Altrimenti, verifichiamo se il calendario esiste nella lista dei calendari disponibili
      const response = await this.calendar.calendarList.get({
        calendarId: calendarId
      });
      
      this.log('info', `Calendario con ID ${calendarId} verificato con successo`);
      return true;
    } catch (error: any) {
      // Se otteniamo un 404, il calendario non esiste
      if (error?.response?.status === 404 || 
          (error?.errors && error.errors[0]?.reason === 'notFound')) {
        this.log('warn', `Calendario con ID ${calendarId} non trovato`);
        return false;
      }
      
      // Per altri errori, logghiamo e assumiamo che il calendario non sia utilizzabile
      this.log('error', `Errore durante la verifica del calendario ${calendarId}:`, error);
      return false;
    }
  }

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
    let usingFallback = false;
    
    // Se nelle impostazioni è specificato un calendario specifico, lo usiamo
    if (settings?.selectedCalendarId) {
      // Verifichiamo se il calendario selezionato esiste
      const calendarExists = await this.verifyCalendarExists(settings.selectedCalendarId);
      
      if (calendarExists) {
        calendarId = settings.selectedCalendarId;
        this.log('info', `Utilizzo calendario selezionato con ID: ${calendarId}`);
      } else {
        // Se il calendario non esiste, utilizziamo il calendario primario come fallback
        this.log('warn', `Calendario selezionato con ID: ${settings.selectedCalendarId} non trovato, utilizzo calendario primario come fallback`);
        calendarId = 'primary';
        usingFallback = true;
      }
    }

    // Assicuriamoci che il nome del paziente sia disponibile
    const patientName = appointment.patient_name || 'Paziente';
    
    // Formatta il titolo dell'evento includendo il titolo dell'appuntamento e il nome del paziente
    const eventTitle = appointment.title 
      ? `${appointment.title}: ${patientName}` 
      : `Appuntamento: ${patientName}`;
      
    this.log('info', `Creazione evento calendario con titolo: ${eventTitle}`);
      
    const event: calendar_v3.Schema$Event = {
      summary: eventTitle,
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

    try {
      const response = await this.calendar!.events.insert({
        calendarId: calendarId,
        requestBody: event
      });
      
      // Se abbiamo usato il fallback, aggiorniamo le impostazioni per evitare futuri errori
      if (usingFallback && settings) {
        try {
          // Aggiorniamo le impostazioni per utilizzare il calendario primario
          settings.selectedCalendarId = 'primary';
          const jsonSettings = JSON.stringify(settings);
          
          this.db = getDatabase();
          if (this.db) {
            this.db.prepare('UPDATE app_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?')
              .run(jsonSettings, 'calendar');
            this.log('info', 'Impostazioni del calendario aggiornate per utilizzare il calendario primario');
          }
        } catch (updateError) {
          this.log('warn', 'Impossibile aggiornare le impostazioni del calendario', updateError);
          // Non interrompiamo il flusso principale
        }
      }
      
      return response.data.id || '';
    } catch (error: any) {
      // Se otteniamo un 404, proviamo con il calendario primario se non lo stiamo già usando
      if ((error?.response?.status === 404 || (error?.errors && error.errors[0]?.reason === 'notFound')) && calendarId !== 'primary') {
        this.log('warn', `Errore 404 durante la creazione dell'evento nel calendario ${calendarId}, tentativo con calendario primario`);
        
        try {
          const fallbackResponse = await this.calendar!.events.insert({
            calendarId: 'primary',
            requestBody: event
          });
          
          // Aggiorniamo le impostazioni per utilizzare il calendario primario
          if (settings) {
            try {
              settings.selectedCalendarId = 'primary';
              const jsonSettings = JSON.stringify(settings);
              
              this.db = getDatabase();
              if (this.db) {
                this.db.prepare('UPDATE app_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?')
                  .run(jsonSettings, 'calendar');
                this.log('info', 'Impostazioni del calendario aggiornate per utilizzare il calendario primario');
              }
            } catch (updateError) {
              this.log('warn', 'Impossibile aggiornare le impostazioni del calendario', updateError);
              // Non interrompiamo il flusso principale
            }
          }
          
          return fallbackResponse.data.id || '';
        } catch (fallbackError) {
          this.log('error', 'Errore anche durante il tentativo con calendario primario', fallbackError);
          throw fallbackError;
        }
      }
      
      // Per altri errori, li logghiamo e li propaghiamo
      this.log('error', 'Errore durante la creazione dell\'evento su Google Calendar', error);
      throw error;
    }
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
    let usingFallback = false;
    
    // Se nelle impostazioni è specificato un calendario specifico, lo usiamo
    if (settings?.selectedCalendarId) {
      // Verifichiamo se il calendario selezionato esiste
      const calendarExists = await this.verifyCalendarExists(settings.selectedCalendarId);
      
      if (calendarExists) {
        calendarId = settings.selectedCalendarId;
        this.log('info', `Utilizzo calendario selezionato con ID: ${calendarId}`);
      } else {
        // Se il calendario non esiste, utilizziamo il calendario primario come fallback
        this.log('warn', `Calendario selezionato con ID: ${settings.selectedCalendarId} non trovato, utilizzo calendario primario come fallback`);
        calendarId = 'primary';
        usingFallback = true;
      }
    }

    // Formatta il titolo dell'evento includendo il titolo dell'appuntamento e il nome del paziente
    const eventTitle = appointment.title 
      ? `${appointment.title}: ${appointment.patient_name}` 
      : `Appuntamento: ${appointment.patient_name}`;
      
    const event: calendar_v3.Schema$Event = {
      summary: eventTitle,
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

    try {
      await this.calendar.events.update({
        calendarId: calendarId,
        eventId: appointment.google_calendar_event_id,
        requestBody: event
      });
      
      // Se abbiamo usato il fallback, aggiorniamo le impostazioni per evitare futuri errori
      if (usingFallback && settings) {
        try {
          // Aggiorniamo le impostazioni per utilizzare il calendario primario
          settings.selectedCalendarId = 'primary';
          const jsonSettings = JSON.stringify(settings);
          
          this.db = getDatabase();
          if (this.db) {
            this.db.prepare('UPDATE app_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?')
              .run(jsonSettings, 'calendar');
            this.log('info', 'Impostazioni del calendario aggiornate per utilizzare il calendario primario');
          }
        } catch (updateError) {
          this.log('warn', 'Impossibile aggiornare le impostazioni del calendario', updateError);
          // Non interrompiamo il flusso principale
        }
      }
    } catch (error: any) {
      // Se otteniamo un 404, proviamo con il calendario primario se non lo stiamo già usando
      if ((error?.response?.status === 404 || (error?.errors && error.errors[0]?.reason === 'notFound')) && calendarId !== 'primary') {
        this.log('warn', `Errore 404 durante l'aggiornamento dell'evento nel calendario ${calendarId}, tentativo con calendario primario`);
        
        try {
          await this.calendar.events.update({
            calendarId: 'primary',
            eventId: appointment.google_calendar_event_id,
            requestBody: event
          });
          
          // Aggiorniamo le impostazioni per utilizzare il calendario primario
          if (settings) {
            try {
              settings.selectedCalendarId = 'primary';
              const jsonSettings = JSON.stringify(settings);
              
              this.db = getDatabase();
              if (this.db) {
                this.db.prepare('UPDATE app_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?')
                  .run(jsonSettings, 'calendar');
                this.log('info', 'Impostazioni del calendario aggiornate per utilizzare il calendario primario');
              }
            } catch (updateError) {
              this.log('warn', 'Impossibile aggiornare le impostazioni del calendario', updateError);
              // Non interrompiamo il flusso principale
            }
          }
        } catch (fallbackError) {
          this.log('error', 'Errore anche durante il tentativo con calendario primario', fallbackError);
          throw fallbackError;
        }
      } else {
        // Per altri errori, li logghiamo e li propaghiamo
        this.log('error', 'Errore durante l\'aggiornamento dell\'evento su Google Calendar', error);
        throw error;
      }
    }
  }

  async syncAppointment(appointment: Appointment): Promise<{ id: string }> {
    this.log('info', `Inizio sincronizzazione appuntamento ID: ${appointment.id}`, {
      patient_name: appointment.patient_name,
      start_time: appointment.start_time,
      end_time: appointment.end_time,
      has_google_id: !!appointment.google_calendar_event_id
    });
    
    try {
      // Verifica se il servizio è abilitato prima di procedere
      const isEnabled = await this.isServiceEnabled().catch(() => false);
      if (!isEnabled) {
        this.log('warn', 'Servizio Google Calendar non abilitato, sincronizzazione saltata');
        return { id: '' };
      }
      
      // Verifica se il servizio è autenticato (questo configurerà anche il client)
      const isAuthenticated = await this.isServiceAuthenticated().catch(() => false);
      if (!isAuthenticated) {
        this.log('warn', 'Servizio Google Calendar non autenticato, sincronizzazione saltata');
        return { id: '' };
      }
      
      if (!this.calendar) {
        this.log('info', 'Client Google Calendar non inizializzato, tentativo di configurazione');
        try {
          await this.configure();
          if (!this.calendar) {
            this.log('error', 'Impossibile autenticare il servizio Google Calendar dopo la configurazione');
            return { id: '' };
          }
        } catch (configError) {
          this.log('error', 'Errore durante la configurazione di Google Calendar', configError);
          return { id: '' };
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
      this.log('info', `Aggiornamento stato di sincronizzazione per l'appuntamento ${appointmentId} a ${status}`);
      
      try {
        this.db = getDatabase();
        
        // Verifica se la tabella appointments esiste
        const tableExists = this.db.prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='appointments'`
        ).get();
        
        if (!tableExists) {
          this.log('error', 'Tabella appointments non trovata nel database');
          return;
        }
        
        // Utilizziamo una query parametrizzata con il metodo run
        try {
          this.db.prepare(
            'UPDATE appointments SET sync_status = ?, google_calendar_event_id = ? WHERE id = ?'
          ).run(status, eventId ?? null, appointmentId);
          this.log('info', `Stato di sincronizzazione aggiornato con successo per l'appuntamento ${appointmentId}`);
        } catch (execError) {
          // Se fallisce il primo approccio, proviamo con un metodo alternativo
          this.log('warn', `Tentativo alternativo di aggiornamento per l'appuntamento ${appointmentId}`, execError);
          this.db.prepare('UPDATE appointments SET sync_status = ?, google_calendar_event_id = ? WHERE id = ?')
                     .run(status, eventId ?? null, appointmentId);
        }
      } catch (dbError) {
        // Gestisci specificamente l'errore di database non inizializzato
        if (dbError instanceof Error && dbError.message.includes('Database non inizializzato')) {
          this.log('error', 'Database non inizializzato durante l\'aggiornamento dello stato di sincronizzazione');
        } else {
          this.log('error', 'Errore durante l\'accesso al database', dbError);
        }
      }
    } catch (error) {
      // Catturiamo specificamente l'errore di transazione già in corso
      if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' && error.message.includes('within a transaction')) {
        this.log('warn', `Impossibile aggiornare lo stato di sincronizzazione per l'appuntamento ${appointmentId}: transazione già in corso. L'aggiornamento verrà gestito in seguito.`);
      } else {
        this.log('error', 'Errore durante l\'aggiornamento dello stato di sincronizzazione', error);
      }
      // Non propaghiamo l'errore per evitare di interrompere il flusso principale
    }
  }

  private async getUnsyncedAppointments(): Promise<Appointment[]> {
    try {
      this.log('info', 'Recupero appuntamenti non sincronizzati');
      this.db = getDatabase();
      
      // Verifica se la tabella appointments esiste
      const tableExists = this.db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='appointments'`
      ).get();
      
      if (!tableExists) {
        this.log('warn', 'Tabella appointments non trovata nel database');
        return [];
      }
      
      // Recupera gli appuntamenti che non sono mai stati sincronizzati (sync_status IS NULL)
      // o che sono stati modificati dopo l'ultima sincronizzazione (sync_status = 'modified')
      const appointments = this.db.prepare(
        `SELECT a.*, u.first_name, u.last_name 
         FROM appointments a 
         LEFT JOIN users u ON a.patient_id = u.id 
         WHERE a.sync_status IS NULL OR a.sync_status = 'modified'`
      ).all() as Appointment[] || [];
      
      this.log('info', `Trovati ${appointments.length} appuntamenti non sincronizzati`);
      return appointments;
    } catch (error) {
      // Gestisci specificamente l'errore di database non inizializzato
      if (error instanceof Error && error.message.includes('Database non inizializzato')) {
        this.log('error', 'Database non inizializzato durante il recupero degli appuntamenti non sincronizzati');
      } else {
        this.log('error', 'Errore durante il recupero degli appuntamenti non sincronizzati', error);
      }
      return [];
    }
  }
  
  /**
   * Recupera gli appuntamenti futuri che devono essere sincronizzati
   * @returns Array di appuntamenti futuri da sincronizzare
   */
  private async getFutureAppointments(): Promise<Appointment[]> {
    try {
      this.log('info', 'Recupero appuntamenti futuri da sincronizzare');
      this.db = getDatabase();
      
      // Verifica se la tabella appointments esiste
      const tableExists = this.db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='appointments'`
      ).get();
      
      if (!tableExists) {
        this.log('warn', 'Tabella appointments non trovata nel database');
        return [];
      }
      
      // Data corrente in formato ISO
      const currentDate = new Date().toISOString();
      
      // Recupera gli appuntamenti futuri che non sono mai stati sincronizzati o che sono stati modificati
      const appointments = this.db.prepare(
        `SELECT a.*, u.first_name, u.last_name 
         FROM appointments a 
         LEFT JOIN users u ON a.patient_id = u.id 
         WHERE (a.sync_status IS NULL OR a.sync_status = 'modified') 
         AND a.start_time > ? 
         ORDER BY a.start_time ASC`
      ).all(currentDate) as Appointment[] || [];
      
      this.log('info', `Trovati ${appointments.length} appuntamenti futuri da sincronizzare`);
      return appointments;
    } catch (error) {
      // Gestisci specificamente l'errore di database non inizializzato
      if (error instanceof Error && error.message.includes('Database non inizializzato')) {
        this.log('error', 'Database non inizializzato durante il recupero degli appuntamenti futuri');
      } else {
        this.log('error', 'Errore durante il recupero degli appuntamenti futuri', error);
      }
      return [];
    }
  }

  private async markAppointmentSynced(appointmentId: number): Promise<void> {
    try {
      this.log('info', `Marcando appuntamento ${appointmentId} come sincronizzato`);
      this.db = getDatabase();
      
      // Verifica se la tabella appointments esiste
      const tableExists = this.db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='appointments'`
      ).get();
      
      if (!tableExists) {
        this.log('warn', 'Tabella appointments non trovata nel database');
        return;
      }
      
      this.db.prepare('UPDATE appointments SET sync_status = ? WHERE id = ?').run('synced', appointmentId);
      this.log('info', `Appuntamento ${appointmentId} marcato come sincronizzato con successo`);
    } catch (error) {
      // Gestisci specificamente l'errore di database non inizializzato
      if (error instanceof Error && error.message.includes('Database non inizializzato')) {
        this.log('error', 'Database non inizializzato durante la marcatura dell\'appuntamento come sincronizzato');
      } else {
        this.log('error', `Errore durante la marcatura dell'appuntamento ${appointmentId} come sincronizzato`, error);
      }
    }
  }

  private async handleSyncError(appointmentId: number, error: any): Promise<void> {
    try {
      this.log('info', `Registrazione errore di sincronizzazione per l'appuntamento ${appointmentId}`);
      this.db = getDatabase();
      
      // Verifica se la tabella appointments esiste
      const tableExists = this.db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='appointments'`
      ).get();
      
      if (!tableExists) {
        this.log('warn', 'Tabella appointments non trovata nel database');
        return;
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
      this.db.prepare('UPDATE appointments SET sync_error = ?, sync_status = ? WHERE id = ?').run(errorMessage, 'failed', appointmentId);
      this.log('info', `Errore di sincronizzazione registrato per l'appuntamento ${appointmentId}`);
    } catch (dbError) {
      // Gestisci specificamente l'errore di database non inizializzato
      if (dbError instanceof Error && dbError.message.includes('Database non inizializzato')) {
        this.log('error', 'Database non inizializzato durante la registrazione dell\'errore di sincronizzazione');
      } else {
        this.log('error', `Errore durante la registrazione dell'errore di sincronizzazione per l'appuntamento ${appointmentId}`, dbError);
      }
    }
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
   * @param eventId - ID dell'evento da eliminare
   * @returns Promise<void>
   */
  async deleteCalendarEvent(eventId: string): Promise<void> {
    this.log('info', `Tentativo di eliminazione evento Google Calendar con ID: ${eventId}`);
    
    if (!this.calendar) {
      this.log('info', 'Client Google Calendar non inizializzato, tentativo di configurazione');
      await this.configure();
    }
    
    if (!this.calendar) {
      this.log('error', 'Google Calendar service non autenticato dopo tentativo di configurazione');
      throw new Error('Google Calendar service non autenticato');
    }

    // Otteniamo le impostazioni del calendario
    const settings = await this.getCalendarSettings();
    // Usiamo il calendario primario come default
    let calendarId = 'primary';
    let usingFallback = false;
    
    // Se nelle impostazioni è specificato un calendario specifico, lo usiamo
    if (settings?.selectedCalendarId) {
      // Verifichiamo se il calendario selezionato esiste
      const calendarExists = await this.verifyCalendarExists(settings.selectedCalendarId);
      
      if (calendarExists) {
        calendarId = settings.selectedCalendarId;
        this.log('info', `Utilizzo calendario selezionato con ID: ${calendarId}`);
      } else {
        // Se il calendario non esiste, utilizziamo il calendario primario come fallback
        this.log('warn', `Calendario selezionato con ID: ${settings.selectedCalendarId} non trovato, utilizzo calendario primario come fallback`);
        calendarId = 'primary';
        usingFallback = true;
      }
    }

    try {
      // Prima verifichiamo se l'evento esiste
      this.log('info', `Verifica esistenza evento con ID: ${eventId}`);
      try {
        await this.calendar.events.get({
          calendarId: calendarId,
          eventId: eventId
        });
        this.log('info', `Evento con ID ${eventId} trovato, procedo con l'eliminazione`);
      } catch (getError: any) {
        // Se l'evento non esiste (404) e non stiamo usando il calendario primario, proviamo con quello
        if ((getError?.response?.status === 404 || 
            (getError?.errors && getError.errors[0]?.reason === 'notFound')) && 
            calendarId !== 'primary') {
          
          this.log('warn', `Evento con ID ${eventId} non trovato nel calendario ${calendarId}, tentativo con calendario primario`);
          
          try {
            await this.calendar.events.get({
              calendarId: 'primary',
              eventId: eventId
            });
            this.log('info', `Evento con ID ${eventId} trovato nel calendario primario, procedo con l'eliminazione`);
            calendarId = 'primary';
            usingFallback = true;
          } catch (primaryGetError: any) {
            // Se l'evento non esiste neanche nel calendario primario, consideriamo l'operazione come completata
            if (primaryGetError?.response?.status === 404 || 
                (primaryGetError?.errors && primaryGetError.errors[0]?.reason === 'notFound')) {
              this.log('warn', `Evento con ID ${eventId} non trovato in nessun calendario, considerato già eliminato`);
              return; // Usciamo dalla funzione senza errori
            }
            // Per altri errori, li logghiamo e continuiamo con il tentativo di eliminazione
            this.log('warn', `Errore durante la verifica dell'esistenza dell'evento nel calendario primario: ${primaryGetError?.message || 'Errore sconosciuto'}`);
          }
        } else if (getError?.response?.status === 404 || 
                   (getError?.errors && getError.errors[0]?.reason === 'notFound')) {
          // Se l'evento non esiste e stiamo già usando il calendario primario, consideriamo l'operazione come completata
          this.log('warn', `Evento con ID ${eventId} non trovato su Google Calendar, considerato già eliminato`);
          return; // Usciamo dalla funzione senza errori
        }
        // Per altri errori, li logghiamo e continuiamo con il tentativo di eliminazione
        this.log('warn', `Errore durante la verifica dell'esistenza dell'evento: ${getError?.message || 'Errore sconosciuto'}`);
      }

      // Procediamo con l'eliminazione
      await this.calendar.events.delete({
        calendarId: calendarId,
        eventId: eventId
      });
      this.log('info', `Evento con ID ${eventId} eliminato con successo`);
      
      // Se abbiamo usato il fallback, aggiorniamo le impostazioni per evitare futuri errori
      if (usingFallback && settings) {
        try {
          // Aggiorniamo le impostazioni per utilizzare il calendario primario
          settings.selectedCalendarId = 'primary';
          const jsonSettings = JSON.stringify(settings);
          
          this.db = getDatabase();
          if (this.db) {
            this.db.prepare('UPDATE app_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?')
              .run(jsonSettings, 'calendar');
            this.log('info', 'Impostazioni del calendario aggiornate per utilizzare il calendario primario');
          }
        } catch (updateError) {
          this.log('warn', 'Impossibile aggiornare le impostazioni del calendario', updateError);
          // Non interrompiamo il flusso principale
        }
      }
    } catch (error: any) {
      // Gestione specifica per errore 404 (Not Found) se non stiamo già usando il calendario primario
      if ((error?.response?.status === 404 || 
          (error?.errors && error.errors[0]?.reason === 'notFound')) && 
          calendarId !== 'primary') {
        
        this.log('warn', `Errore 404 durante l'eliminazione dell'evento nel calendario ${calendarId}, tentativo con calendario primario`);
        
        try {
          await this.calendar.events.delete({
            calendarId: 'primary',
            eventId: eventId
          });
          this.log('info', `Evento con ID ${eventId} eliminato con successo dal calendario primario`);
          
          // Aggiorniamo le impostazioni per utilizzare il calendario primario
          if (settings) {
            try {
              settings.selectedCalendarId = 'primary';
              const jsonSettings = JSON.stringify(settings);
              
              this.db = getDatabase();
              if (this.db) {
                this.db.prepare('UPDATE app_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?')
                  .run(jsonSettings, 'calendar');
                this.log('info', 'Impostazioni del calendario aggiornate per utilizzare il calendario primario');
              }
            } catch (updateError) {
              this.log('warn', 'Impossibile aggiornare le impostazioni del calendario', updateError);
              // Non interrompiamo il flusso principale
            }
          }
          
          return; // Operazione completata con successo
        } catch (fallbackError: any) {
          // Se anche questo fallisce con 404, consideriamo l'evento come già eliminato
          if (fallbackError?.response?.status === 404 || 
              (fallbackError?.errors && fallbackError.errors[0]?.reason === 'notFound')) {
            this.log('warn', `Evento con ID ${eventId} non trovato durante l'eliminazione dal calendario primario, considerato già eliminato`);
            return; // Usciamo dalla funzione senza errori
          }
          
          this.log('error', 'Errore anche durante il tentativo con calendario primario', fallbackError);
          throw fallbackError;
        }
      } else if (error?.response?.status === 404 || 
                 (error?.errors && error.errors[0]?.reason === 'notFound')) {
        // Se stiamo già usando il calendario primario e otteniamo 404, consideriamo l'evento come già eliminato
        this.log('warn', `Evento con ID ${eventId} non trovato durante l'eliminazione, considerato già eliminato`);
        return; // Usciamo dalla funzione senza errori
      }
      
      // Per altri errori, li logghiamo e li propaghiamo
      this.log('error', `Errore durante l'eliminazione dell'evento da Google Calendar:`, error);
      throw new Error(`Errore durante l'eliminazione dell'evento: ${error?.message || 'Errore sconosciuto'}`);
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
   * Sincronizza automaticamente gli appuntamenti futuri con Google Calendar
   * Questo metodo è progettato per essere chiamato periodicamente da un job schedulato
   * @returns Un array con i risultati della sincronizzazione
   */
  public async autoSyncAppointments(): Promise<{id: number, success: boolean, message: string}[]> {
    this.log('info', 'Avvio sincronizzazione automatica degli appuntamenti futuri');
    
    if (!await this.isServiceEnabled()) {
      this.log('warn', 'Sincronizzazione automatica non eseguita: servizio Google Calendar non abilitato');
      return [{id: 0, success: false, message: 'Servizio Google Calendar non abilitato'}];
    }

    if (!await this.isServiceAuthenticated()) {
      this.log('warn', 'Sincronizzazione automatica non eseguita: servizio Google Calendar non autenticato');
      return [{id: 0, success: false, message: 'Servizio Google Calendar non autenticato'}];
    }

    const futureAppointments = await this.getFutureAppointments();
    this.log('info', `Trovati ${futureAppointments.length} appuntamenti futuri da sincronizzare`);
    
    if (futureAppointments.length === 0) {
      this.log('info', 'Nessun appuntamento futuro da sincronizzare');
      return [];
    }
    
    const results = [];
    
    for (const appointment of futureAppointments) {
      try {
        this.log('info', `Sincronizzazione automatica appuntamento ID: ${appointment.id}`, {
          patient_name: appointment.patient_name,
          title: appointment.title,
          start_time: appointment.start_time
        });
        
        if (appointment.google_calendar_event_id) {
          await this.updateCalendarEvent(appointment);
          this.log('info', `Aggiornato evento esistente per appuntamento ID: ${appointment.id}`);
          results.push({id: appointment.id, success: true, message: 'Evento aggiornato con successo'});
        } else {
          const eventId = await this.createCalendarEvent(appointment);
          this.log('info', `Creato nuovo evento per appuntamento ID: ${appointment.id}, Event ID: ${eventId}`);
          await this.updateLocalAppointmentSyncStatus(appointment.id, 'synced', eventId);
          results.push({id: appointment.id, success: true, message: `Evento creato con successo, ID: ${eventId}`});
        }
        await this.markAppointmentSynced(appointment.id);
      } catch (error) {
        this.log('error', `Errore durante la sincronizzazione automatica dell'appuntamento ID: ${appointment.id}`, error);
        await this.handleSyncError(appointment.id, error);
        results.push({id: appointment.id, success: false, message: error instanceof Error ? error.message : 'Errore sconosciuto'});
      }
    }
    
    this.log('info', `Sincronizzazione automatica completata per ${results.length} appuntamenti`);
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
      
      // Valori predefiniti
      let pendingAppointments = 0;
      let lastSync = null;
      
      // Verifica se il database è disponibile
      try {
        this.db = getDatabase();
        if (!this.db) throw new Error('Database connection failed');
        
        // Verifica se la tabella appointments esiste
        const tableExists = this.db.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='appointments'"
        ).get();
        
        if (tableExists) {
          // Verifica quali colonne esistono nella tabella appointments
          const columnInfo = this.db.prepare("PRAGMA table_info(appointments)").all();
          const syncStatusExists = columnInfo.some((col: any) => col.name === 'sync_status');
          const updatedAtExists = columnInfo.some((col: any) => col.name === 'updated_at');
          const googleCalendarEventIdExists = columnInfo.some((col: any) => col.name === 'google_calendar_event_id');
          
          // Conta gli appuntamenti in attesa di sincronizzazione se la colonna esiste
          if (syncStatusExists) {
            const pendingCount = this.db.prepare(
              'SELECT COUNT(*) as count FROM appointments WHERE sync_status IS NULL OR sync_status = "pending"'
            ).get() as { count: number } | undefined;
            pendingAppointments = pendingCount?.count || 0;
          } else if (googleCalendarEventIdExists) {
            // Alternativa se sync_status non esiste ma google_calendar_event_id sì
            const pendingCount = this.db.prepare(
              'SELECT COUNT(*) as count FROM appointments WHERE google_calendar_event_id IS NULL'
            ).get() as { count: number } | undefined;
            pendingAppointments = pendingCount?.count || 0;
          }
          
          // Ottieni la data dell'ultima sincronizzazione se le colonne esistono
          if (syncStatusExists && updatedAtExists) {
            const lastSyncRecord = this.db.prepare(
              'SELECT MAX(updated_at) as last_sync FROM appointments WHERE sync_status = "synced"'
            ).get() as { last_sync: string } | undefined;
            lastSync = lastSyncRecord?.last_sync || null;
          }
        }
      } catch (dbError) {
        this.log('warn', 'Errore durante l\'accesso al database', dbError);
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
        lastSync,
        pendingAppointments,
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
      
      const appointment = this.db.prepare(
        'SELECT * FROM appointments WHERE id = ?'
      ).get(appointmentId) as Appointment | undefined;
      
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
      const setting = this.db.prepare(
        'SELECT * FROM app_settings WHERE key = ?'
      ).get('calendar') as AppSetting | undefined;
      
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
      this.db.prepare(
        'UPDATE app_settings SET value = ? WHERE key = ?'
      ).run(JSON.stringify(calendarSettings), 'calendar');
      
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
      const setting = this.db.prepare(
        'SELECT * FROM app_settings WHERE key = ?'
      ).get('calendar') as AppSetting | undefined;
      
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
      this.db.prepare(
        'UPDATE app_settings SET value = ? WHERE key = ?'
      ).run(JSON.stringify(calendarSettings), 'calendar');
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
      
      // Ottieni le impostazioni del calendario per determinare quale calendario utilizzare
      const settings = await this.getCalendarSettings();
      // Usa il calendario selezionato nelle impostazioni, se disponibile, altrimenti usa 'primary'
      const calendarId = settings?.selectedCalendarId || 'primary';
      
      this.log('info', `Sincronizzazione eventi dal calendario: ${calendarId}`);
      
      // Ottieni gli eventi da Google Calendar (ultimi 30 giorni e prossimi 90 giorni)
      const now = new Date();
      const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const timeMax = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
      
      const response = await this.calendar.events.list({
        calendarId: calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime'
      });
      
      const events = response.data.items || [];
      
      this.log('info', `Trovati ${events.length} eventi nel calendario ${calendarId}`);
      
      let eventiImportati = 0;
      let eventiAggiornati = 0;
      let eventiSaltati = 0;
      
      for (const event of events) {
        if (!event.id) {
          this.log('warn', 'Evento senza ID saltato');
          eventiSaltati++;
          continue;
        }
        
        // Non filtriamo più per event.start.dateTime, gestiamo entrambi i formati di data
        
        // Verifica se l'evento esiste già nel database
        const existingAppointment = (await this.db.prepare(
          'SELECT * FROM appointments WHERE google_calendar_event_id = ?'
        )).get(event.id) as unknown as Appointment | undefined;
        
        if (existingAppointment) {
          // Aggiorna l'appuntamento esistente solo se non è già sincronizzato
          if (!existingAppointment.synced) {
            try {
              await this.updateAppointmentFromEvent(existingAppointment.id, event);
              this.log('info', `Aggiornato appuntamento esistente con ID: ${existingAppointment.id} da evento: ${event.id}`);
              eventiAggiornati++;
            } catch (updateError) {
              this.log('error', `Errore durante l'aggiornamento dell'appuntamento ${existingAppointment.id}`, updateError);
              eventiSaltati++;
            }
          } else {
            this.log('info', `Appuntamento ${existingAppointment.id} già sincronizzato, nessun aggiornamento necessario`);
            eventiSaltati++;
          }
        } else {
          // Crea un nuovo appuntamento
          try {
            const newAppointment = await this.createAppointmentInDatabase(event);
            this.log('info', `Creato nuovo appuntamento con ID: ${newAppointment.id} da evento: ${event.id}`);
            eventiImportati++;
          } catch (createError) {
            this.log('error', `Errore durante la creazione dell'appuntamento da evento ${event.id}`, createError);
            eventiSaltati++;
          }
        }
      }
      
      // Log dettagliato dei risultati della sincronizzazione
      this.log('info', `Sincronizzazione completata: ${eventiImportati} eventi importati, ${eventiAggiornati} eventi aggiornati, ${eventiSaltati} eventi saltati`);
      
      // Aggiorna le statistiche di sincronizzazione nelle impostazioni
      try {
        const settings = await this.getCalendarSettings();
        if (settings) {
          settings.lastSyncFromGoogle = new Date().toISOString();
          settings.lastSyncStats = {
            importati: eventiImportati,
            aggiornati: eventiAggiornati,
            saltati: eventiSaltati,
            totale: events.length
          };
          
          const jsonSettings = JSON.stringify(settings);
          this.db.prepare('UPDATE app_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?')
            .run(jsonSettings, 'calendar');
        }
      } catch (statsError) {
        this.log('warn', 'Impossibile aggiornare le statistiche di sincronizzazione', statsError);
      }
    } catch (error) {
      this.log('error', 'Errore durante la sincronizzazione degli eventi da Google Calendar:', error);
    }
  }

  /**
   * Estrae informazioni dell'utente dalle note dell'evento di Google Calendar
   * @param description - Descrizione dell'evento (note)
   * @returns Informazioni dell'utente estratte
   */
  private extractUserInfoFromEventDescription(description: string): {
    fullName?: string;
    email?: string;
    phone?: string;
    birthDate?: string;
    birthCity?: string;
    fiscalCode?: string;
  } {
    this.log('info', 'Estrazione informazioni utente dalle note dell\'evento');
    
    const userInfo: {
      //paziente?: string;
      fullName?: string;
      email?: string;
      phone?: string;
      birthDate?: string;
      birthCity?: string;
      fiscalCode?: string;
    } = {};
    
    if (!description) {
      this.log('warn', 'Nessuna descrizione disponibile nell\'evento');
      return userInfo;
    }
    
    // Estrai il nome completo
    const nameMatch = description.match(/<b>Prenotato da<\/b>\s*([^<]+)/);
    if (nameMatch && nameMatch[1]) {
      //userInfo.paziente = nameMatch[1].trim();
      userInfo.fullName = nameMatch[1].trim();
      
      this.log('info', `Nome estratto: ${userInfo.fullName}`);
    }
    
    // Estrai l'email
    const emailMatch = description.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
    if (emailMatch && emailMatch[1]) {
      userInfo.email = emailMatch[1].trim();
      this.log('info', `Email estratta: ${userInfo.email}`);
    }
    
    // Estrai il numero di telefono
    const phoneMatch = description.match(/([0-9]{10})/);
    if (phoneMatch && phoneMatch[1]) {
      userInfo.phone = phoneMatch[1].trim();
      this.log('info', `Telefono estratto: ${userInfo.phone}`);
    }
    
    // Estrai la data di nascita
    const birthDateMatch = description.match(/<b>data di nascita<\/b>\s*([^<]+)/);
    if (birthDateMatch && birthDateMatch[1]) {
      userInfo.birthDate = birthDateMatch[1].trim();
      this.log('info', `Data di nascita estratta: ${userInfo.birthDate}`);
    }
    
    // Estrai la città di nascita
    const birthCityMatch = description.match(/<b>città di nascita<\/b>\s*([^<]+)/);
    if (birthCityMatch && birthCityMatch[1]) {
      userInfo.birthCity = birthCityMatch[1].trim();
      this.log('info', `Città di nascita estratta: ${userInfo.birthCity}`);
    }
    
    // Estrai il codice fiscale
    const fiscalCodeMatch = description.match(/<b>codice fiscale<\/b>\s*([^<\s]+)/);
    if (fiscalCodeMatch && fiscalCodeMatch[1]) {
      userInfo.fiscalCode = fiscalCodeMatch[1].trim();
      this.log('info', `Codice fiscale estratto: ${userInfo.fiscalCode}`);
    }
    
    return userInfo;
  }
  
  /**
   * Crea o trova un utente basato sulle informazioni estratte dalle note dell'evento
   * @param userInfo - Informazioni dell'utente estratte
   * @returns ID dell'utente creato o trovato
   */
  private async createOrFindUserFromEventInfo(userInfo: {
    fullName?: string;
    email?: string;
    phone?: string;
    birthDate?: string;
    birthCity?: string;
    fiscalCode?: string;
  }): Promise<number | undefined> {
    if (!this.db) throw new Error('Database non inizializzato');
    
    // Se abbiamo un codice fiscale, verifichiamo se esiste già un utente con questo codice
    if (userInfo.fiscalCode) {
      this.log('info', `Verifica esistenza utente con codice fiscale: ${userInfo.fiscalCode}`);
      const existingUser = this.db.prepare(
        'SELECT id FROM users WHERE fiscal_code = ? LIMIT 1'
      ).get(userInfo.fiscalCode) as { id: number } | undefined;
      
      if (existingUser) {
        this.log('info', `Utente esistente trovato con ID: ${existingUser.id}`);
        return existingUser.id;
      }
    }
    
    // Se non abbiamo trovato un utente con il codice fiscale e non abbiamo abbastanza informazioni per crearne uno nuovo
    if (!userInfo.fullName) {
      this.log('warn', 'Informazioni insufficienti per creare un nuovo utente');
      return undefined;
    }
    
    // Estrai nome e cognome
    let firstName = '';
    let lastNameFull = '';
    let lastName = '';
    
    if (userInfo.fullName) {
      const nameParts = userInfo.fullName.split(' ');
      if (nameParts.length >= 2) {
        firstName = nameParts[0];
        //lastName = nameParts[1];
        lastNameFull = nameParts.slice(1).join(' ');
        lastName = lastNameFull.split('\n')[0];
        this.log('info', `Nome e cognome estratti: ${firstName} ${lastName}`);
        this.log('info','prova trim: '+lastName)
      } else if (nameParts.length === 1) {
        firstName = nameParts[0];
        lastName = '';
      }
    }
    
    // Formatta la data di nascita se presente (da DD/MM/YYYY a YYYY-MM-DD)
    let formattedBirthDate: string | null = null;
    if (userInfo.birthDate) {
      const parts = userInfo.birthDate.split('/');
      if (parts.length === 3) {
        formattedBirthDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    
    // Crea un nuovo utente
    this.log('info', 'Creazione nuovo utente con le informazioni estratte');
    try {
      const stmt = this.db.prepare(`
        INSERT INTO users (
          first_name, last_name, email, phone, birth_date, birth_city, fiscal_code, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      
      const result = stmt.run(
        firstName,
        lastName,
        userInfo.email || null,
        userInfo.phone || null,
        formattedBirthDate,
        userInfo.birthCity || null,
        userInfo.fiscalCode || null
      );
      
      const newUserId = result.lastInsertRowid as number;
      this.log('info', `Nuovo utente creato con ID: ${newUserId}`);
      return newUserId;
    } catch (error) {
      this.log('error', 'Errore durante la creazione del nuovo utente', error);
      return undefined;
    }
  }

  /**
   * Crea un appuntamento nel database da un evento di Google Calendar
   */
  private async createAppointmentInDatabase(event: calendar_v3.Schema$Event): Promise<Appointment> {
    if (!this.db) throw new Error('Database non inizializzato');
    
    // Verifica che l'evento abbia date valide
    if (!event.start || (!event.start.dateTime && !event.start.date) || !event.end || (!event.end.dateTime && !event.end.date)) {
      this.log('error', 'Evento con date mancanti o non valide', { eventId: event.id, summary: event.summary });
      throw new Error('Evento con date mancanti o non valide');
    }
    
    // Gestisci sia eventi con dateTime (con orario) che date (solo giorno)
    // Correggiamo il problema del fuso orario utilizzando le date originali e preservando l'orario esatto
    let startTime: Date;
    let endTime: Date;
    
    if (event.start.dateTime) {
      // Utilizziamo Date.parse per ottenere il timestamp UTC e poi creiamo una data preservando l'orario originale
      const startDateTimeStr = event.start.dateTime;
      const startTimestamp = Date.parse(startDateTimeStr);
      startTime = new Date(startTimestamp);
      
      // Log per debug del fuso orario
      this.log('info', 'Data di inizio originale e parsata', {
        original: startDateTimeStr,
        parsed: startTime.toISOString(),
        localTime: startTime.toString()
      });
    } else {
      // Se abbiamo solo una data, impostiamo l'ora a 00:00:00
      startTime = new Date(`${event.start.date}T00:00:00`);
    }
    
    if (event.end.dateTime) {
      // Utilizziamo Date.parse per ottenere il timestamp UTC e poi creiamo una data preservando l'orario originale
      const endDateTimeStr = event.end.dateTime;
      const endTimestamp = Date.parse(endDateTimeStr);
      endTime = new Date(endTimestamp);
      
      // Log per debug del fuso orario
      this.log('info', 'Data di fine originale e parsata', {
        original: endDateTimeStr,
        parsed: endTime.toISOString(),
        localTime: endTime.toString()
      });
    } else {
      // Se abbiamo solo una data, impostiamo l'ora a 23:59:59
      endTime = new Date(`${event.end.date}T23:59:59`);
    }
    
    // Verifica che le date siano valide
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      this.log('error', 'Date dell\'evento non valide', { 
        eventId: event.id, 
        summary: event.summary,
        startDate: event.start.dateTime || event.start.date,
        endDate: event.end.dateTime || event.end.date
      });
      throw new Error('Date dell\'evento non valide');
    }
    
    // Estrai il nome del paziente dal titolo dell'evento
    const patientName = event.summary?.replace('Appuntamento: ', '').replace(' (', '').replace(')','') || '';
    
    // Estrai informazioni dell'utente dalle note dell'evento
    let patientId: number | undefined = undefined;
    
    if (event.description) {
      this.log('info', 'Evento con descrizione trovato, tentativo di estrazione informazioni utente');
      const userInfo = this.extractUserInfoFromEventDescription(event.description);
      
      // Se abbiamo estratto informazioni utili, tenta di creare o trovare l'utente
      if (userInfo.fiscalCode || userInfo.fullName) {
        patientId = await this.createOrFindUserFromEventInfo(userInfo);
        this.log('info', `Utente associato all'appuntamento con ID: ${patientId || 'non trovato'}`);
      }
    }
    
    // Se non abbiamo trovato un utente dalle note, cerca per nome come fallback
    if (!patientId && patientName && patientName !== 'Paziente senza nome') {
      const nameParts = patientName.split(' ');
      if (nameParts.length >= 2) {
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');
        
        const userResult = this.db.prepare(
          'SELECT id FROM users WHERE first_name LIKE ? AND last_name LIKE ? LIMIT 1'
        ).get(`${firstName}%`, `${lastName}%`) as { id: number } | undefined;
        
        if (userResult) {
          patientId = userResult.id;
          this.log('info', `Utente trovato per nome: ${patientName}, ID: ${patientId}`);
        }
      }
    }
    
    // Calcola la durata in minuti
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = Math.round(durationMs / (1000 * 60));
    
    // Formatta data e ora
    // Estrai i componenti della data direttamente dalla stringa ISO per evitare conversioni di fuso orario
    // Questo garantisce che l'orario visualizzato sia esattamente quello specificato in Google Calendar
    let year, month, day, hours, minutes;
    
    if (event.start.dateTime) {
      // Parsing manuale della stringa ISO 8601 (formato: YYYY-MM-DDTHH:MM:SS+OFFSET)
      const isoDateMatch = event.start.dateTime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      if (isoDateMatch) {
        [, year, month, day, hours, minutes] = isoDateMatch;
      } else {
        // Fallback nel caso il pattern non corrisponda
        year = startTime.getUTCFullYear();
        month = String(startTime.getUTCMonth() + 1).padStart(2, '0');
        day = String(startTime.getUTCDate()).padStart(2, '0');
        hours = String(startTime.getUTCHours()).padStart(2, '0');
        minutes = String(startTime.getUTCMinutes()).padStart(2, '0');
      }
    } else {
      // Per eventi di tutto il giorno
      year = startTime.getUTCFullYear();
      month = String(startTime.getUTCMonth() + 1).padStart(2, '0');
      day = String(startTime.getUTCDate()).padStart(2, '0');
      hours = "00";
      minutes = "00";
    }
    
    const date = `${year}-${month}-${day}`;
    const time = `${hours}:${minutes}`;
    
    this.log('info', 'Orario appuntamento formattato', {
      originalDateTime: event.start.dateTime || event.start.date,
      formattedDate: date,
      formattedTime: time
    });
    
    // Determina lo stato dell'appuntamento (scheduled per default)
    const status = 'scheduled';
    
    const stmt = this.db.prepare(
      'INSERT INTO appointments (patient_id, date, time, notes, title, duration, google_calendar_event_id, synced, sync_status, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(
      patientId, 
      date, 
      time, 
      //event.description || '',
      '',
      patientName,
      durationMinutes,
      event.id || null,
      1, // già sincronizzato
      'synced',
      status
    );

    return {
      id: result.lastInsertRowid ? Number(result.lastInsertRowid) : 0,
      patient_id: patientId,
      patient_name: patientName, // per compatibilità con l'interfaccia
      start_time: startTime.toISOString(), // Aggiungi start_time richiesto dall'interfaccia
      end_time: endTime.toISOString(), // Aggiungi end_time richiesto dall'interfaccia
      date: date,
      time: time,
      notes: '',
      //notes: event.description || '',
      title: patientName,
      duration: durationMinutes,
      google_calendar_event_id: event.id || null,
      synced: 1,
      sync_status: 'synced',
      status: status
    };
  }

  /**
   * Aggiorna un appuntamento da un evento di Google Calendar
   */
  protected async updateAppointmentFromEvent(appointmentId: number | undefined, event: calendar_v3.Schema$Event): Promise<void> {
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
          const stmt = this.db.prepare(
            'SELECT * FROM appointments WHERE google_calendar_event_id = ?'
          );
          const appointmentToDelete = stmt.get(resourceId) as Appointment | undefined;
          
          if (appointmentToDelete) {
            // Elimina l'appuntamento
            const deleteStmt = this.db.prepare('DELETE FROM appointments WHERE id = ?');
            deleteStmt.run(appointmentToDelete.id);
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
      
      const setting = this.db.prepare(
        'SELECT * FROM app_settings WHERE key = ?'
      ).get('calendar') as AppSetting | undefined;
      
      if (setting) {
        const calendarSettings = JSON.parse(setting.value);
        calendarSettings.availableCalendars = calendars.map(cal => ({
          id: cal.id || '',
          summary: cal.summary || ''
        }));
        
        const updateStmt = this.db.prepare(
          'UPDATE app_settings SET value = ? WHERE key = ?'
        );
        updateStmt.run(
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
    
    const stmt = this.db.prepare(
      'SELECT * FROM app_settings WHERE key = ?'
    );
    const setting = stmt.get('calendar') as AppSetting;
    
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
      
      const updateStmt = this.db.prepare(
        'UPDATE app_settings SET value = ? WHERE key = ?'
      );
      updateStmt.run(
        JSON.stringify(calendarSettings),
        'calendar'
      );
      
      console.log(`Calendario selezionato: ${response.data.summary} (${calendarId})`);
    } catch (error) {
      console.error('Errore durante la selezione del calendario:', error);
      throw error;
    }
  }}
