import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import setupRoutes from './routes/setup.routes';
import usersRoutes from './routes/users.routes';
import comuniRoutes from './routes/comuni.routes';
import appointmentsRoutes from './routes/appointments.routes';
import notificationsRoutes from './routes/notifications.routes';
import templatesRoutes from './routes/templates.routes';
import appointmentTypesRoutes from './routes/appointment-types.routes';
import settingsRoutes from './routes/settings.routes';
import licenseRoutes from './routes/license.routes';
import backupsRoutes from './routes/backups.routes';
import { googleCalendarRoutes } from './routes/google-calendar.routes';
import { checkDatabaseConnection } from './config/database-sqlite';
import { runSqliteMigrations } from './db/migrations/sqlite-migrations';
import { GoogleCalendarService } from './services/google-calendar.service';
import { appointmentStatusService } from './services/appointment-status.service';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Aggiungi una route per la root
app.get('/', (req, res) => {
  res.json({ 
    message: 'SlabsLink API Server (SQLite)', 
    status: 'running',
    endpoints: [
      '/api/health',
      '/api/setup',
      '/api/users',
      '/api/comuni',
      '/api/appointments',
      '/api/notifications',
      '/api/templates',
      '/api/appointment-types',
      '/api/settings',
      '/api/backups'
    ]
  });
});

// Routes
app.use('/api/setup', setupRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/comuni', comuniRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/appointment-types', appointmentTypesRoutes);
app.use('/api/settings', settingsRoutes);
// Registro licenseRoutes separatamente
app.use('/api/license', licenseRoutes);
// Registro Google Calendar routes
app.use('/api/google-calendar', googleCalendarRoutes);
// Register backup routes
app.use('/api/backups', backupsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: 'sqlite' });
});

// Aggiungiamo un middleware per loggare tutte le richieste
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Inizializza il database e avvia il server
const startServer = async () => {
  try {
    // Verifica la connessione al database
    const connected = checkDatabaseConnection();
    if (!connected) {
      console.error('Impossibile connettersi al database SQLite. Il server non verrà avviato.');
      process.exit(1);
    }
    
    // Esegui le migrazioni
    const migrationsSuccess = await runSqliteMigrations();
    if (!migrationsSuccess) {
      console.error('Errore durante l\'esecuzione delle migrazioni SQLite. Il server non verrà avviato.');
      process.exit(1);
    }
    
    // Avvia il server
    const server = app.listen(PORT, () => {
      console.log(`Server in esecuzione su http://localhost:${PORT}`);
    });
    
    // Inizializza il servizio Google Calendar
    const googleCalendarService = new GoogleCalendarService();
    
    // Configura la sincronizzazione automatica degli appuntamenti con Google Calendar
    // Esegui la sincronizzazione ogni ora alle :00 minuti
    cron.schedule('0 * * * *', async () => {
      console.log(`[${new Date().toISOString()}] Avvio sincronizzazione automatica degli appuntamenti con Google Calendar`);
      try {
        // Verifica se il servizio è abilitato e autenticato
        const isEnabled = await googleCalendarService.isServiceEnabled();
        const isAuthenticated = isEnabled ? await googleCalendarService.isServiceAuthenticated() : false;
        
        if (isEnabled && isAuthenticated) {
          // Esegui la sincronizzazione automatica
          const results = await googleCalendarService.autoSyncAppointments();
          console.log(`[${new Date().toISOString()}] Sincronizzazione completata: ${results.length} appuntamenti processati`);
          
          // Log dei risultati
          const successCount = results.filter(r => r.success).length;
          const failCount = results.filter(r => !r.success).length;
          console.log(`[${new Date().toISOString()}] Risultati sincronizzazione: ${successCount} successi, ${failCount} fallimenti`);
        } else {
          console.log(`[${new Date().toISOString()}] Sincronizzazione automatica saltata: servizio ${!isEnabled ? 'non abilitato' : 'non autenticato'}`);
        }
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Errore durante la sincronizzazione automatica:`, error);
      }
    });
    
    // Configura la sincronizzazione da Google Calendar a SlabsLink
    // Esegui la sincronizzazione ogni 10 minuti
    cron.schedule('*/10 * * * *', async () => {
      console.log(`[${new Date().toISOString()}] Avvio sincronizzazione eventi da Google Calendar a SlabsLink`);
      try {
        // Verifica se il servizio è abilitato e autenticato
        const isEnabled = await googleCalendarService.isServiceEnabled();
        const isAuthenticated = isEnabled ? await googleCalendarService.isServiceAuthenticated() : false;
        
        if (isEnabled && isAuthenticated) {
          // Esegui la sincronizzazione da Google Calendar a SlabsLink
          await googleCalendarService.syncEventsFromGoogleCalendar();
          console.log(`[${new Date().toISOString()}] Sincronizzazione da Google Calendar a SlabsLink completata`);
        } else {
          console.log(`[${new Date().toISOString()}] Sincronizzazione da Google Calendar saltata: servizio ${!isEnabled ? 'non abilitato' : 'non autenticato'}`);
        }
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Errore durante la sincronizzazione da Google Calendar:`, error);
      }
    });
    
    // Configura l'aggiornamento automatico dello stato degli appuntamenti scaduti
    // Esegui il controllo ogni 5 minuti
    cron.schedule('*/5 * * * *', async () => {
      console.log(`[${new Date().toISOString()}] Avvio controllo appuntamenti scaduti`);
      try {
        // Aggiorna gli appuntamenti scaduti
        const updatedCount = await appointmentStatusService.updateExpiredAppointments();
        console.log(`[${new Date().toISOString()}] Controllo appuntamenti scaduti completato: ${updatedCount} appuntamenti aggiornati`);
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Errore durante il controllo degli appuntamenti scaduti:`, error);
      }
    });
  } catch (error) {
    console.error('Errore durante l\'avvio del server:', error);
    process.exit(1);
  }
};

startServer();

// Gestione della chiusura del server
process.on('SIGINT', () => {
  console.log('Chiusura del server...');
  // Chiudi la connessione al database
  const { closeDatabase } = require('./config/database-sqlite');
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Chiusura del server...');
  // Chiudi la connessione al database
  const { closeDatabase } = require('./config/database-sqlite');
  closeDatabase();
  process.exit(0);
});