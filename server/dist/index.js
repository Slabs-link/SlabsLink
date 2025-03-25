"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const setup_routes_1 = __importDefault(require("./routes/setup.routes"));
const users_routes_1 = __importDefault(require("./routes/users.routes"));
const comuni_routes_1 = __importDefault(require("./routes/comuni.routes"));
const appointments_routes_1 = __importDefault(require("./routes/appointments.routes"));
const notifications_routes_1 = __importDefault(require("./routes/notifications.routes"));
const templates_routes_1 = __importDefault(require("./routes/templates.routes"));
const database_sqlite_1 = require("./config/database-sqlite");
const sqlite_migrations_1 = require("./db/migrations/sqlite-migrations");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
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
            '/api/templates'
        ]
    });
});
// Routes
app.use('/api/setup', setup_routes_1.default);
app.use('/api/users', users_routes_1.default);
app.use('/api/comuni', comuni_routes_1.default);
app.use('/api/appointments', appointments_routes_1.default);
app.use('/api/notifications', notifications_routes_1.default);
app.use('/api/templates', templates_routes_1.default);
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
const startServer = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Verifica la connessione al database
        const connected = (0, database_sqlite_1.checkDatabaseConnection)();
        if (!connected) {
            console.error('Impossibile connettersi al database SQLite. Il server non verrà avviato.');
            process.exit(1);
        }
        // Esegui le migrazioni
        const migrationsSuccess = yield (0, sqlite_migrations_1.runSqliteMigrations)();
        if (!migrationsSuccess) {
            console.error('Errore durante l\'esecuzione delle migrazioni SQLite. Il server non verrà avviato.');
            process.exit(1);
        }
        // Avvia il server
        app.listen(PORT, () => {
            console.log(`Server in esecuzione su http://localhost:${PORT}`);
        });
    }
    catch (error) {
        console.error('Errore durante l\'avvio del server:', error);
        process.exit(1);
    }
});
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
