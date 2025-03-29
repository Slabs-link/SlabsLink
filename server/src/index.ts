import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import setupRoutes from './routes/setup.routes';
import usersRoutes from './routes/users.routes';
import comuniRoutes from './routes/comuni.routes';
import appointmentsRoutes from './routes/appointments.routes';
import notificationsRoutes from './routes/notifications.routes';
import templatesRoutes from './routes/templates.routes';
import appointmentTypesRoutes from './routes/appointment-types.routes';
import settingsRoutes from './routes/settings.routes';
import licenseRoutes from './routes/license.routes';
import { checkDatabaseConnection } from './config/database-sqlite';
import { runSqliteMigrations } from './db/migrations/sqlite-migrations';

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
      '/api/settings'
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
import { googleCalendarRoutes } from './routes/google-calendar.routes';
// ... existing code ...
app.use('/api/google-calendar', googleCalendarRoutes);

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
    app.listen(PORT, () => {
      console.log(`Server in esecuzione su http://localhost:${PORT}`);
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