import express from 'express';
import { Router, Request, Response } from 'express';
import { getAuthUrl, handleAuthCallback, handleWebhook, setupWebhook, getCalendarEvents, syncAppointments } from '../controllers/google-calendar.controller';
import { GoogleCalendarService } from '../services/google-calendar.service';
import { Appointment } from '../interfaces/appointment.interface';
import { calendar_v3 } from 'googleapis/build/src/apis/calendar/v3';
import { getDatabase } from '../config/database-sqlite';
import { AppSetting } from '../interfaces/app-setting.interface';
import { CalendarSettings } from '../interfaces/calendar-settings.interface';
import { convertToGoogleCalendarEvent } from '../utils/google-calendar-utils';

const router = express.Router();

// Esporta le rotte
export const googleCalendarRoutes = router;


// Endpoint per ottenere gli eventi dal calendario
router.get('/events', getCalendarEvents);

// Endpoint per l'autenticazione OAuth2 di Google Calendar
router.get('/auth', getAuthUrl);

// Endpoint per generare l'URL di autenticazione
router.get('/auth-url', getAuthUrl);

// Endpoint di callback per l'autenticazione OAuth2
router.get('/callback', handleAuthCallback);

// Webhook per ricevere notifiche di eventi da Google Calendar
router.post('/webhook', handleWebhook);

// Endpoint per configurare il webhook
router.post('/setup-webhook', setupWebhook);

// Endpoint per sincronizzare gli appuntamenti con Google Calendar
router.post('/sync', syncAppointments);

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
    if (!googleEvent.start?.dateTime) {
      throw new Error('Missing start dateTime in Google Calendar event');
    }
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
    if (!googleEvent.start?.dateTime) {
      throw new Error('Missing start dateTime in Google Calendar event');
    }
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

// Aggiungi le rotte aggiuntive al router
router.post('/webhook-callback', async (req, res) => {
  try {
    const channelId = req.headers['x-goog-channel-id'];
    const resourceId = req.headers['x-goog-resource-id'];
    const resourceState = req.headers['x-goog-resource-state'];

    if (resourceState === 'sync') {
      return res.status(200).send('Sync completed');
    }

    const event = req.body;
    const googleCalendarService = new GoogleCalendarService();
    await googleCalendarService.processCalendarEvent(resourceState as string, resourceId as string, channelId as string);
    
    res.status(200).send('Event processed');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal server error');
  }
});

router.post('/webhook-setup', async (req, res) => {
  try {
    const webhookUrl = req.body.webhookUrl;
    const googleCalendarService = new GoogleCalendarService();
    await googleCalendarService.setupWebhook(webhookUrl);
    res.status(200).json({ message: 'Webhook configurato correttamente' });
  } catch (error) {
    console.error('Webhook setup error:', error);
    res.status(500).json({ error: 'Errore nella configurazione del webhook' });
  }
});


// Endpoint per ottenere la lista dei calendari disponibili
router.get('/calendars', async (req: Request, res: Response) => {
  try {
    const calendarService = new GoogleCalendarService();
    await calendarService.configure();
    const calendars = await calendarService.getAvailableCalendars();
    res.json({ calendars });
  } catch (error: any) {
    console.error('Errore durante il recupero dei calendari:', error);
    res.status(500).json({ 
      message: 'Errore durante il recupero dei calendari', 
      error: error.message 
    });
  }
});

// Endpoint per impostare il calendario selezionato
router.post('/select-calendar', async (req: Request, res: Response) => {
  try {
    const { calendarId } = req.body;
    if (!calendarId) {
      return res.status(400).json({ message: 'ID calendario mancante' });
    }
    
    const calendarService = new GoogleCalendarService();
    await calendarService.configure();
    await calendarService.setSelectedCalendar(calendarId);
    
    res.json({ message: 'Calendario selezionato con successo' });
  } catch (error: any) {
    console.error('Errore durante la selezione del calendario:', error);
    res.status(500).json({ 
      message: 'Errore durante la selezione del calendario', 
      error: error.message 
    });
  }
});

