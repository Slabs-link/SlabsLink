import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { DatabaseManager } from './config/database-sqlite';
import { initializeComuniTable } from './controllers/comuni-sqlite.controller';
import { initializeDatabase } from './config/init-database';
import { getDatabase } from './config/database-sqlite';
import axios, { AxiosError } from 'axios';
import { googleCalendarRoutes } from './routes/google-calendar.routes';
import { runSqliteMigrations } from './db/migrations/sqlite-migrations';

// Create a fresh Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Enhanced logging function
const logToFile = (message: string) => {
  // Utilizziamo un percorso assoluto per la cartella logs
  const logDir = path.join(__dirname, '..', 'logs');
  console.log(`Attempting to create/access log directory at: ${logDir}`);
  
  try {
    if (!fs.existsSync(logDir)) {
      console.log(`Log directory does not exist, creating it now...`);
      fs.mkdirSync(logDir, { recursive: true });
      console.log(`Log directory created successfully`);
    }
    
    const logFile = path.join(logDir, 'server.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
    console.log(`[${timestamp}] ${message}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error with logging: ${error.message}`);
    }
    console.error(`Current directory: ${__dirname}`);
    // Fallback to console-only logging
    console.log(`[${new Date().toISOString()}] ${message}`);
  }
};

// Initialize database
const dbManager = DatabaseManager.getInstance();
// Replace the line causing the error
// db.initializeDatabase();  // This is causing the error

// Call the function directly instead
initializeDatabase();

// Then get the database instance
const db = getDatabase();
initializeComuniTable();

// Essential middleware with very permissive CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: '*',
  credentials: true
}));

// Parse JSON bodies with increased size limit
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Raw body parser for debugging
app.use((req, res, next) => {
  let data = '';
  req.on('data', chunk => {
    data += chunk;
  });
  
  req.on('end', () => {
    if (data) {
      logToFile(`Raw request body: ${data}`);
      try {
        if (!req.body || Object.keys(req.body).length === 0) {
          (req as any).rawBody = data;
          try {
            req.body = JSON.parse(data);
          } catch (e) {
            if (e instanceof Error) {
              logToFile(`Failed to parse JSON body: ${e.message}`);
            }
          }
        }
      } catch (e) {
        if (e instanceof Error) {
          logToFile(`Error processing raw body: ${e.message}`);
        }
      }
    }
    next();
  });
});

// Detailed logging middleware
app.use((req, res, next) => {
  logToFile(`Request: ${req.method} ${req.url}`);
  logToFile(`Headers: ${JSON.stringify(req.headers, null, 2)}`);
  
  if (req.body && Object.keys(req.body).length > 0) {
    logToFile(`Body: ${JSON.stringify(req.body, null, 2)}`);
  }
  
  // Capture response for logging
  const originalSend = res.send;
  res.send = function(body) {
    logToFile(`Response: ${res.statusCode} ${typeof body === 'object' ? JSON.stringify(body) : body}`);
    return originalSend.call(this, body);
  };
  
  next();
});

// OPTIONS pre-flight handler for all routes
app.options('*', (req, res) => {
  logToFile('Handling OPTIONS request');
  res.status(200).end();
});

// Test endpoint
app.get('/api/test', (req, res) => {
  logToFile('Test endpoint called');
  res.json({ message: 'API server is running correctly', timestamp: new Date().toISOString() });
});

// Endpoint per verificare i log - Corretto
app.get('/api/logs/status', (req, res) => {
  try {
    const logDir = path.join(__dirname, '..', 'logs');
    const logFile = path.join(logDir, 'server.log');
    
    const dirExists = fs.existsSync(logDir);
    const fileExists = fs.existsSync(logFile);
    
    let fileContent = '';
    if (fileExists) {
      fileContent = fs.readFileSync(logFile, 'utf8').split('\n').slice(-20).join('\n');
    }
    
    res.json({
      logDirectoryPath: logDir,
      logFilePath: logFile,
      logDirectoryExists: dirExists,
      logFileExists: fileExists,
      lastLogEntries: fileContent,
      currentDirectory: __dirname,
      serverDirectory: path.join(__dirname, '..')
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      currentDirectory: __dirname
    });
  }
});

// Import routes
import licenseRoutes from './routes/license.routes';
import settingsRoutes from './routes/settings.routes';
import notificationsRoutes from './routes/notifications.routes';

// Register routes
app.use('/api/license', licenseRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationsRoutes);
// Mount the Google Calendar routes
app.use('/api/google-calendar', googleCalendarRoutes);
// Manteniamo anche il vecchio percorso per retrocompatibilità
app.use('/api/google', googleCalendarRoutes);

// Not found middleware
app.use((req, res) => {
  logToFile(`Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ message: `Cannot ${req.method} ${req.url}` });
});

// Error handling middleware
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  // Type guard per AxiosError
if (typeof err === 'object' && err !== null && 'isAxiosError' in err && 'response' in err) {
  const axiosError = err as AxiosError;
  if (axiosError.response) {
    logToFile(`Errore Axios - Status: ${axiosError.response.status}`);
    logToFile(`Dettagli: ${JSON.stringify(axiosError.response?.data)}`);
    logToFile(`Headers: ${JSON.stringify(axiosError.response?.headers)}`);
  }
  logToFile(`Richiesta: ${JSON.stringify(axiosError.request)}`);
} 
// Type guard per Error
else if (err instanceof Error) {
  logToFile(`Errore generico: ${err.message}`);
  logToFile(`Stack trace: ${err.stack || 'Nessuno stack trace disponibile'}`);
} 
// Controllo strutturale migliorato
else if (typeof err === 'object' && err !== null) {
  const errorDetails = {
    ...('message' in err && { message: String((err as Record<string, unknown>).message) }),
    ...('code' in err && { code: String((err as Record<string, unknown>).code) }),
    ...('stack' in err && { stack: String((err as Record<string, unknown>).stack) })
  };
  logToFile('Errore strutturato: ' + JSON.stringify(errorDetails));
} 
else {
  logToFile('Errore sconosciuto: ' + JSON.stringify(err));
}

const errorMessage = (err && 
  (typeof err === 'object' && 
    ('message' in err && typeof err.message === 'string')))
  ? err.message
  : 'Errore sconosciuto';
  
  res.status(500).json({
    message: 'Internal server error',
    error: typeof errorMessage === 'string' ? errorMessage : 'Errore sconosciuto'
  });
});

// Start server
const startServer = async () => {
  try {
    // Esegui le migrazioni prima di avviare il server
    const migrationsSuccessful = await runSqliteMigrations();
    if (!migrationsSuccessful) {
      console.error('Migrazioni fallite. Il server non verrà avviato.');
      process.exit(1); // Esce se le migrazioni falliscono
    }

    // Avvia il server solo se le migrazioni hanno avuto successo
    app.listen(PORT, () => {
      console.log(`Server in ascolto sulla porta ${PORT}`);
      logToFile(`Test endpoint: http://localhost:${PORT}/api/test`);
      logToFile(`Notifications endpoints: http://localhost:${PORT}/api/notifications`);
    });

  } catch (error) {
    console.error('Errore durante l\'avvio del server o le migrazioni:', error);
    process.exit(1);
  }
};

// Avvia il server
startServer();

export default app;