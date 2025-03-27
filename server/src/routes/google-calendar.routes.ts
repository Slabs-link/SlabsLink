import express from 'express';

import { Request, Response } from 'express';
import { calendar_v3 } from 'googleapis';
import { Router } from 'express';
import { getDatabase } from '../../db/migrations/migration';
import type { calendar_v3 } from 'googleapis';
import { GoogleCalendarService } from '../services/google-calendar.service';

import { Appointment } from '../interfaces/appointment.interface';

export const googleCalendarRoutes = Router();
const googleCalendarService = new GoogleCalendarService();

// Interfaccia per le impostazioni del calendario
interface CalendarSettings {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  tokens?: any;
  googleCalendarEnabled?: boolean;
  channelId?: string;
  resourceId?: string;
  expiration?: string;
}

// Interfaccia per le impostazioni dell'app
interface AppSetting {
  id: number;
  key: string;
  value: string;
  created_at?: string;
  updated_at?: string;
}

const router = express.Router();

// Interfaccia per gli eventi di Google Calendar
interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  status: string;
}

// Funzione per convertire un evento di Google Calendar in un evento compatibile
function convertToGoogleCalendarEvent(event: calendar_v3.Schema$Event): GoogleCalendarEvent {
  if (!event.id || !event.start?.dateTime || !event.end?.dateTime) {
    throw new Error('Evento Google Calendar non valido');
  }
  
  return {
    id: event.id,
    summary: event.summary || 'Evento senza titolo',
    description: event.description || '',
    start: {
      dateTime: event.start.dateTime,
      timeZone: event.start.timeZone || 'Europe/Rome'
    },
    end: {
      dateTime: event.end.dateTime,
      timeZone: event.end.timeZone || 'Europe/Rome'
    },
    status: event.status || 'confirmed'
  };
}

// Endpoint per ottenere gli eventi dal calendario
router.get('/events', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const setting = db.prepare('SELECT * FROM app_settings WHERE key = ?').get('calendar') as AppSetting | undefined;
    
    if (!setting) {
      return res.status(400).json({ message: 'Impostazioni di Google Calendar non configurate' });
    }
    
    // Converti il valore JSON in oggetto JavaScript
    let calendarSettings: CalendarSettings;
    try {
      calendarSettings = JSON.parse(setting.value);
    } catch (error) {
      return res.status(500).json({ message: 'Errore nel parsing delle impostazioni' });
    }
    
    if (!calendarSettings.tokens) {
      return res.status(400).json({ message: 'Token di Google Calendar mancanti' });
    }
    
    // Importa dinamicamente le librerie di Google
    const { google } = await import('googleapis');
    
    // Crea un client OAuth2
    const oauth2Client = new google.auth.OAuth2(
      calendarSettings.clientId,
      calendarSettings.clientSecret,
      calendarSettings.redirectUri
    );
    
    // Imposta i token
    oauth2Client.setCredentials(calendarSettings.tokens);
    
    // Crea un client per Google Calendar
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Ottieni gli eventi dal calendario
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: (new Date()).toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    const events = response.data.items || [];
    
    // Converti gli eventi nel formato richiesto
    const formattedEvents = events.map(event => {
      try {
        return convertToGoogleCalendarEvent(event);
      } catch (error) {
        console.error('Errore nella conversione dell\'evento:', error);
        return null;
      }
    }).filter(event => event !== null);
    
    return res.json({
      message: 'Eventi recuperati con successo',
      events: formattedEvents
    });
  } catch (error: any) {
    console.error('Errore durante il recupero degli eventi:', error);
    return res.status(500).json({ 
      message: 'Errore durante il recupero degli eventi', 
      error: error.message 
    });
  }
});

// Endpoint per l'autenticazione OAuth2 di Google Calendar
router.get('/auth', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    
    // Verifica se la tabella app_settings esiste
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='app_settings'
    `).get();
    
    if (!tableExists) {
      return res.status(400).json({ message: 'Impostazioni non configurate' });
    }
    
    const setting = db.prepare('SELECT * FROM app_settings WHERE key = ?').get('calendar') as AppSetting | undefined;
    
    if (!setting) {
      return res.status(400).json({ message: 'Impostazioni di Google Calendar non configurate' });
    }
    
    // Converti il valore JSON in oggetto JavaScript
    let calendarSettings: CalendarSettings;
    try {
      calendarSettings = JSON.parse(setting.value);
    } catch (error) {
      return res.status(500).json({ message: 'Errore nel parsing delle impostazioni' });
    }
    
    if (!calendarSettings.clientId || !calendarSettings.clientSecret || !calendarSettings.redirectUri) {
      return res.status(400).json({ message: 'Credenziali OAuth2 mancanti' });
    }
    
    // Reindirizza l'utente alla pagina di autenticazione di Google
    res.redirect(`/api/google-calendar/auth-url?clientId=${calendarSettings.clientId}&clientSecret=${calendarSettings.clientSecret}&redirectUri=${calendarSettings.redirectUri}`);
  } catch (error: any) {
    console.error('Errore durante l\'autenticazione con Google Calendar:', error);
    return res.status(500).json({ 
      message: 'Errore durante l\'autenticazione con Google Calendar', 
      error: error.message 
    });
  }
});

// Endpoint per generare l'URL di autenticazione
router.get('/auth-url', async (req: Request, res: Response) => {
  try {
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
    
    // Reindirizza l'utente all'URL di autenticazione di Google
    res.redirect(authUrl);
  } catch (error: any) {
    console.error('Errore durante la generazione dell\'URL di autenticazione:', error);
    return res.status(500).json({ 
      message: 'Errore durante la generazione dell\'URL di autenticazione', 
      error: error.message 
    });
  }
});

// Endpoint di callback per l'autenticazione OAuth2
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({ message: 'Codice di autorizzazione mancante' });
    }
    
    const db = getDatabase();
    const setting = db.prepare('SELECT * FROM app_settings WHERE key = ?').get('calendar') as AppSetting | undefined;
    
    if (!setting) {
      return res.status(400).json({ message: 'Impostazioni di Google Calendar non configurate' });
    }
    
    // Converti il valore JSON in oggetto JavaScript
    let calendarSettings: CalendarSettings;
    try {
      calendarSettings = JSON.parse(setting.value);
    } catch (error) {
      return res.status(500).json({ message: 'Errore nel parsing delle impostazioni' });
    }
    
    // Importa dinamicamente le librerie di Google
    const { google } = await import('googleapis');
    
    // Crea un client OAuth2
    const oauth2Client = new google.auth.OAuth2(
      calendarSettings.clientId,
      calendarSettings.clientSecret,
      calendarSettings.redirectUri
    );
    
    // Scambia il codice di autorizzazione con i token di accesso
    const { tokens } = await oauth2Client.getToken(code as string);
    
    // Salva i token nel database
    calendarSettings.tokens = tokens;
    
    // Aggiorna le impostazioni nel database
    db.prepare('UPDATE app_settings SET value = ? WHERE key = ?').run(
      JSON.stringify(calendarSettings),
      'calendar'
    );
    
    // Reindirizza l'utente alla pagina delle impostazioni
    res.redirect('/settings?tab=calendar&auth=success');
  } catch (error: any) {
    console.error('Errore durante lo scambio del codice di autorizzazione:', error);
    return res.status(500).json({ 
      message: 'Errore durante lo scambio del codice di autorizzazione', 
      error: error.message 
    });
  }
});

// Webhook per ricevere notifiche di eventi da Google Calendar
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // Verifica l'intestazione X-Goog-Resource-State per determinare il tipo di evento
    const resourceState = req.headers['x-goog-resource-state'];
    const resourceId = req.headers['x-goog-resource-id'] as string;
    const channelId = req.headers['x-goog-channel-id'] as string;
    
    // Risponde immediatamente a Google per confermare la ricezione
    res.status(200).send('OK');
    
    // Processa l'evento in background
    processCalendarEvent(resourceState as string, resourceId, channelId, req.body);
  } catch (error: any) {
    console.error('Errore durante l\'elaborazione del webhook:', error);
    // Risponde comunque con 200 per evitare che Google riprovi
    res.status(200).send('OK');
  }
});

// Funzione per processare gli eventi di Google Calendar
async function processCalendarEvent(
  resourceState: string,
  resourceId: string,
  channelId: string,
  eventData: any
) {
  try {
    const db = getDatabase();
    const setting = db.prepare('SELECT * FROM app_settings WHERE key = ?').get('calendar') as AppSetting | undefined;
    
    if (!setting) {
      console.error('Impostazioni di Google Calendar non configurate');
      return;
    }
    
    // Converti il valore JSON in oggetto JavaScript
    let calendarSettings: CalendarSettings;
    try {
      calendarSettings = JSON.parse(setting.value);
    } catch (error) {
      console.error('Errore nel parsing delle impostazioni');
      return;
    }
    
    if (!calendarSettings.tokens) {
      console.error('Token di Google Calendar mancanti');
      return;
    }
    
    // Importa dinamicamente le librerie di Google
    const { google } = await import('googleapis');
    
    // Crea un client OAuth2
    const oauth2Client = new google.auth.OAuth2(
      calendarSettings.clientId,
      calendarSettings.clientSecret,
      calendarSettings.redirectUri
    );
    
    // Imposta i token
    oauth2Client.setCredentials(calendarSettings.tokens);
    
    // Crea un client per Google Calendar
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Gestisci l'evento in base al tipo
    switch (resourceState) {
      case 'sync':
        // Inizializzazione del canale di notifica
        console.log('Canale di notifica inizializzato:', channelId);
        break;
        
      case 'exists':
        // Evento creato o modificato
        // Ottieni i dettagli dell'evento
        const event = await calendar.events.get({
          calendarId: 'primary',
          eventId: resourceId
        });
        
        // Verifica se l'evento esiste già nel database
        const existingAppointment = db.prepare(
          'SELECT * FROM appointments WHERE google_calendar_event_id = ?'
        ).get(resourceId) as { id: number } | undefined;
        
        if (existingAppointment) {
          // Aggiorna l'appuntamento esistente
          updateAppointmentFromEvent(existingAppointment.id, event.data);
        } else {
          // Crea un nuovo appuntamento
          createAppointmentFromEvent(event.data);
        }
        break;
        
      case 'not_exists':
        // Evento eliminato
        // Trova l'appuntamento associato all'evento
        const appointmentToDelete = db.prepare(
          'SELECT * FROM appointments WHERE google_calendar_event_id = ?'
        ).get(resourceId) as { id: number } | undefined;
        
        if (appointmentToDelete) {
          // Elimina l'appuntamento
          db.prepare('DELETE FROM appointments WHERE id = ?').run(appointmentToDelete.id);
          console.log(`Appuntamento ${appointmentToDelete.id} eliminato in seguito all'eliminazione dell'evento su Google Calendar`);
        }
        break;
        
      default:
        console.log(`Tipo di evento non gestito: ${resourceState}`);
    }
  } catch (error: any) {
    console.error('Errore durante l\'elaborazione dell\'evento di Google Calendar:', error);
  }
}

// Funzione per creare un appuntamento da un evento di Google Calendar
async function createAppointmentFromEvent(eventData: calendar_v3.Schema$Event) {
  // Converti l'evento in un formato compatibile
  const googleEvent = convertToGoogleCalendarEvent(eventData);
  try {
    const db = getDatabase();
    
    // Estrai il nome del paziente dal titolo dell'evento
    let patientName = 'Paziente senza nome';
    if (googleEvent.summary) {
      const match = googleEvent.summary.match(/Appuntamento: (.+)/);
      if (match && match[1]) {
        patientName = match[1];
      } else {
        patientName = googleEvent.summary;
      }
    }
    
    // Estrai la data e l'ora dall'evento
    const startDateTime = new Date(googleEvent.start.dateTime);
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
      eventData.description || '',
      eventData.id,
      true,
      false,
      'scheduled'
    );
    
    console.log(`Nuovo appuntamento creato da evento Google Calendar: ${eventData.id}`);
  } catch (error: any) {
    console.error('Errore durante la creazione dell\'appuntamento da evento Google Calendar:', error);
  }
}

// Funzione per aggiornare un appuntamento da un evento di Google Calendar
async function updateAppointmentFromEvent(appointmentId: number, eventData: calendar_v3.Schema$Event) {
  // Converti l'evento in un formato compatibile
  const googleEvent = convertToGoogleCalendarEvent(eventData);
  try {
    const db = getDatabase();
    
    // Estrai il nome del paziente dal titolo dell'evento
    let patientName = 'Paziente senza nome';
    if (googleEvent.summary) {
      const match = googleEvent.summary.match(/Appuntamento: (.+)/);
      if (match && match[1]) {
        patientName = match[1];
      } else {
        patientName = googleEvent.summary;
      }
    }
    
    // Estrai la data e l'ora dall'evento
    const startDateTime = new Date(googleEvent.start.dateTime);
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
      eventData.description || '',
      true,
      appointmentId
    );
    
    console.log(`Appuntamento ${appointmentId} aggiornato da evento Google Calendar: ${eventData.id}`);
  } catch (error: any) {
    console.error('Errore durante l\'aggiornamento dell\'appuntamento da evento Google Calendar:', error);
  }
}

// Endpoint per configurare il webhook di Google Calendar
router.post('/watch', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const setting = db.prepare('SELECT * FROM app_settings WHERE key = ?').get('calendar') as AppSetting | undefined;
    
    if (!setting) {
      return res.status(400).json({ message: 'Impostazioni di Google Calendar non configurate' });
    }
    
    // Converti il valore JSON in oggetto JavaScript
    let calendarSettings: CalendarSettings;
    try {
      calendarSettings = JSON.parse(setting.value);
    } catch (error) {
      return res.status(500).json({ message: 'Errore nel parsing delle impostazioni' });
    }
    
    if (!calendarSettings.tokens) {
      return res.status(400).json({ message: 'Token di Google Calendar mancanti' });
    }
    
    // Importa dinamicamente le librerie di Google
    const { google } = await import('googleapis');
    const { v4: uuidv4 } = await import('uuid');
    
    // Crea un client OAuth2
    const oauth2Client = new google.auth.OAuth2(
      calendarSettings.clientId,
      calendarSettings.clientSecret,
      calendarSettings.redirectUri
    );
    
    // Imposta i token
    oauth2Client.setCredentials(calendarSettings.tokens);
    
    // Crea un client per Google Calendar
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Genera un ID univoco per il canale
    const channelId = uuidv4();
    
    // Configura il webhook
    const response = await calendar.events.watch({
      calendarId: 'primary',
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: `${req.protocol}://${req.get('host')}/api/google-calendar/webhook`,
        token: 'token-secret',
        expiration: (Date.now() + 7 * 24 * 60 * 60 * 1000).toString() // 7 giorni, convertito in stringa
      }
    });
    
    // Salva le informazioni del canale nel database
    if (response && response.data) {
      calendarSettings.channelId = response.data.id || undefined;
      calendarSettings.resourceId = response.data.resourceId || undefined;
      calendarSettings.expiration = response.data.expiration || undefined;
    } else {
      throw new Error('Risposta non valida dalla API di Google Calendar');
    }
    
    // Aggiorna le impostazioni nel database
    db.prepare('UPDATE app_settings SET value = ? WHERE key = ?').run(
      JSON.stringify(calendarSettings),
      'calendar'
    );
    
    return res.json({
      message: 'Webhook configurato con successo',
      channelId: response.data?.id,
      expiration: response.data?.expiration ? new Date(Number(response.data.expiration)).toISOString() : undefined
    });
  } catch (error: any) {
    console.error('Errore durante la configurazione del webhook:', error);
    return res.status(500).json({ 
      message: 'Errore durante la configurazione del webhook', 
      error: error.message 
    });
  }
});

// Endpoint per interrompere il webhook di Google Calendar
router.post('/unwatch', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const setting = db.prepare('SELECT * FROM app_settings WHERE key = ?').get('calendar') as AppSetting | undefined;
    
    if (!setting) {
      return res.status(400).json({ message: 'Impostazioni di Google Calendar non configurate' });
    }
    
    // Converti il valore JSON in oggetto JavaScript
    let calendarSettings: CalendarSettings;
    try {
      calendarSettings = JSON.parse(setting.value);
    } catch (error) {
      return res.status(500).json({ message: 'Errore nel parsing delle impostazioni' });
    }
    
    if (!calendarSettings.tokens || !calendarSettings.channelId || !calendarSettings.resourceId) {
      return res.status(400).json({ message: 'Informazioni del canale mancanti' });
    }
    
    // Importa dinamicamente le librerie di Google
    const { google } = await import('googleapis');
    
    // Crea un client OAuth2
    const oauth2Client = new google.auth.OAuth2(
      calendarSettings.clientId,
      calendarSettings.clientSecret,
      calendarSettings.redirectUri
    );
    
    // Imposta i token
    oauth2Client.setCredentials(calendarSettings.tokens);
    
    // Crea un client per Google Calendar
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Interrompi il webhook
    await calendar.channels.stop({
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
    
    return res.json({ message: 'Webhook interrotto con successo' });
  } catch (error: any) {
    console.error('Errore durante l\'interruzione del webhook:', error);
    return res.status(500).json({ 
      message: 'Errore durante l\'interruzione del webhook', 
      error: error.message 
    });
  }
});

// Endpoint per sincronizzare manualmente gli appuntamenti con Google Calendar
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const setting = db.prepare('SELECT * FROM app_settings WHERE key = ?').get('calendar') as AppSetting | undefined;
    
    if (!setting) {
      return res.status(400).json({ message: 'Impostazioni di Google Calendar non configurate' });
    }
    
    // Converti il valore JSON in oggetto JavaScript
    let calendarSettings: CalendarSettings;
    try {
      calendarSettings = JSON.parse(setting.value);
    } catch (error) {
      return res.status(500).json({ message: 'Errore nel parsing delle impostazioni' });
    }
    
    if (!calendarSettings.tokens) {
      return res.status(400).json({ message: 'Token di Google Calendar mancanti' });
    }
    
    // Importa dinamicamente le librerie di Google
    const { google } = await import('googleapis');
    
    // Crea un client OAuth2
    const oauth2Client = new google.auth.OAuth2(
      calendarSettings.clientId,
      calendarSettings.clientSecret,
      calendarSettings.redirectUri
    );
    
    // Imposta i token
    oauth2Client.setCredentials(calendarSettings.tokens);
    
    // Crea un client per Google Calendar
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Ottieni tutti gli appuntamenti non sincronizzati
    const unsyncedAppointments = db.prepare(
      'SELECT * FROM appointments WHERE synced = 0'
    ).all();
    
    // Sincronizza gli appuntamenti con Google Calendar
    const results = [];
    for (const appointment of unsyncedAppointments as Array<{
      id: number;
      patient_name?: string;
      notes?: string;
      date?: string;
      time?: string;
      google_calendar_event_id?: string | null;
    }>) {
      try {
        if (!appointment.google_calendar_event_id) {
          // Crea un nuovo evento su Google Calendar
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
          
          const response = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: event,
          });
          
          // Aggiorna l'appuntamento con l'ID dell'evento di Google Calendar
          db.prepare(
            'UPDATE appointments SET google_calendar_event_id = ?, synced = 1 WHERE id = ?'
          ).run(response.data.id, appointment.id);
          
          results.push({
            id: appointment.id,
            status: 'created',
            eventId: response.data.id
          });
        } else {
          // Aggiorna l'evento esistente su Google Calendar
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
          
          await calendar.events.update({
            calendarId: 'primary',
            eventId: appointment.google_calendar_event_id,
            requestBody: event,
          });
          
          // Marca l'appuntamento come sincronizzato
          db.prepare(
            'UPDATE appointments SET synced = 1 WHERE id = ?'
          ).run(appointment.id);
          
          results.push({
            id: appointment.id,
            status: 'updated',
            eventId: appointment.google_calendar_event_id
          });
        }
      } catch (error: any) {
        console.error(`Errore durante la sincronizzazione dell'appuntamento ${appointment.id}:`, error);
        results.push({
          id: appointment.id,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return res.json({
      message: 'Sincronizzazione completata',
      results
    });
  } catch (error: any) {
    console.error('Errore durante la sincronizzazione con Google Calendar:', error);
    return res.status(500).json({ 
      message: 'Errore durante la sincronizzazione con Google Calendar', 
      error: error.message 
    });
  }
});

export default router;

googleCalendarRoutes.post('/api/google/webhook', async (req, res) => {
  try {
    const channelId = req.headers['x-goog-channel-id'];
    const resourceId = req.headers['x-goog-resource-id'];
    const resourceState = req.headers['x-goog-resource-state'];

    if (resourceState === 'sync') {
      return res.status(200).send('Sync completed');
    }

    const event = req.body;
    await googleCalendarService.handleGoogleUpdate(event.id);
    
    res.status(200).send('Event processed');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal server error');
  }
});

googleCalendarRoutes.post('/api/google/webhook/setup', async (req, res) => {
  try {
    const webhookUrl = req.body.webhookUrl;
    await googleCalendarService.setupWebhook(webhookUrl);
    res.status(200).json({ message: 'Webhook configurato correttamente' });
  } catch (error) {
    console.error('Webhook setup error:', error);
    res.status(500).json({ error: 'Errore nella configurazione del webhook' });
  }
});