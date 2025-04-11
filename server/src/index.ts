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
import userFilesRoutes from './routes/user-files.routes';
import { googleCalendarRoutes } from './routes/google-calendar.routes';
import { checkDatabaseConnection, getDatabase } from './config/database-sqlite';
import { runSqliteMigrations } from './db/migrations/sqlite-migrations';
import { GoogleCalendarService } from './services/google-calendar.service';
import { appointmentStatusService } from './services/appointment-status.service';
// Importo l'interfaccia Notification per risolvere gli errori TypeScript
import { Notification } from './interfaces/notifications.interface';

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
// Register user files routes
app.use('/api/user-files', userFilesRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: 'sqlite' });
});

// Aggiungiamo un middleware per loggare tutte le richieste
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Importo il servizio di backup
import { backupService } from './services/backup.service';

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
    
    // Configura i backup automatici del database
    // Inizializza il servizio di backup e pianifica i backup automatici
    console.log(`[${new Date().toISOString()}] Inizializzazione del servizio di backup automatico`);
    try {
      // Attiva la pianificazione dei backup automatici
      await backupService.scheduleBackups();
      console.log(`[${new Date().toISOString()}] Servizio di backup automatico inizializzato con successo`);
      
      // Esegui un backup iniziale all'avvio del server
      cron.schedule('*/1440 * * * *', async () => {
        console.log(`[${new Date().toISOString()}] Avvio backup automatico del database`);
        try {
          await backupService.createDatabaseBackup();
          console.log(`[${new Date().toISOString()}] Backup automatico completato con successo`);
        } catch (error) {
          console.error(`[${new Date().toISOString()}] Errore durante il backup automatico:`, error);
        }
      });
      
      // Configura l'elaborazione automatica delle notifiche WhatsApp in attesa
      // Esegui l'elaborazione ogni 5 minuti
      cron.schedule('*/5 * * * *', async () => {
        console.log(`[${new Date().toISOString()}] Avvio elaborazione automatica delle notifiche WhatsApp in attesa`);
        try {
          // Ottieni il database
          const db = getDatabase();
          if (!db) {
            throw new Error('Database non disponibile');
          }
          
          // Recupera tutte le notifiche in attesa
          const pendingNotifications = db.prepare(`
            SELECT n.*, u.phone, u.first_name, u.last_name
            FROM notifications n
            JOIN users u ON n.user_id = u.id
            WHERE n.status = 'pending'
            ORDER BY n.created_at ASC
          `).all() as Notification[];
          
          console.log(`[${new Date().toISOString()}] Trovate ${pendingNotifications.length} notifiche in attesa`);
          
          // Importa il servizio WhatsApp
          const WhatsAppService = require('./services/whatsapp.service').default;
          
          // Elabora ogni notifica
          let successCount = 0;
          let failCount = 0;
          
          for (const notification of pendingNotifications) {
            // Applico un type casting esplicito per risolvere gli errori TypeScript
            const typedNotification = notification as Notification;
            try {
              // Verifica che l'utente abbia un numero di telefono
              if (!typedNotification.phone) {
                throw new Error(`L'utente ${typedNotification.user_id} non ha un numero di telefono valido`);
              }
              
              // Invia la notifica WhatsApp
              const success = await WhatsAppService.sendMessage(typedNotification.phone, typedNotification.message);
              
              if (success) {
                // Aggiorna lo stato della notifica a 'sent'
                db.prepare(`
                  UPDATE notifications SET
                    status = 'sent',
                    error_message = NULL,
                    updated_at = datetime('now')
                  WHERE id = ?
                `).run(typedNotification.id);
                
                successCount++;
              } else {
                // Aggiorna lo stato della notifica a 'failed'
                db.prepare(`
                  UPDATE notifications SET
                    status = 'failed',
                    error_message = 'Invio fallito',
                    updated_at = datetime('now')
                  WHERE id = ?
                `).run(typedNotification.id);
                
                failCount++;
              }
            } catch (error) {
              console.error(`[${new Date().toISOString()}] Errore durante l'elaborazione della notifica ${typedNotification.id}:`, error);
              
              // Aggiorna lo stato della notifica a 'failed'
              db.prepare(`
                UPDATE notifications SET
                  status = 'failed',
                  error_message = ?,
                  updated_at = datetime('now')
                WHERE id = ?
              `).run(error instanceof Error ? error.message : 'Errore sconosciuto', notification.id);
              
              failCount++;
            }
          }
          
          console.log(`[${new Date().toISOString()}] Elaborazione notifiche completata: ${successCount} inviate con successo, ${failCount} fallite`);
        } catch (error) {
          console.error(`[${new Date().toISOString()}] Errore durante l'elaborazione automatica delle notifiche:`, error);
        }
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Errore durante l'inizializzazione del servizio di backup:`, error);
    }
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