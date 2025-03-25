"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Create a fresh Express app
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Enhanced logging function
const logToFile = (message) => {
    // Utilizziamo un percorso assoluto per la cartella logs
    const logDir = path_1.default.join(__dirname, '..', 'logs');
    console.log(`Attempting to create/access log directory at: ${logDir}`);
    try {
        if (!fs_1.default.existsSync(logDir)) {
            console.log(`Log directory does not exist, creating it now...`);
            fs_1.default.mkdirSync(logDir, { recursive: true });
            console.log(`Log directory created successfully`);
        }
        const logFile = path_1.default.join(logDir, 'server.log');
        const timestamp = new Date().toISOString();
        fs_1.default.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
        console.log(`[${timestamp}] ${message}`);
    }
    catch (error) {
        if (error instanceof Error) {
            console.error(`Error with logging: ${error.message}`);
        }
        console.error(`Current directory: ${__dirname}`);
        // Fallback to console-only logging
        console.log(`[${new Date().toISOString()}] ${message}`);
    }
};
// Essential middleware with very permissive CORS
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: '*',
    credentials: true
}));
// Parse JSON bodies with increased size limit
app.use(body_parser_1.default.json({ limit: '10mb' }));
app.use(body_parser_1.default.urlencoded({ extended: true, limit: '10mb' }));
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
                    req.rawBody = data;
                    try {
                        req.body = JSON.parse(data);
                    }
                    catch (e) {
                        if (e instanceof Error) {
                            logToFile(`Failed to parse JSON body: ${e.message}`);
                        }
                    }
                }
            }
            catch (e) {
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
    res.send = function (body) {
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
        const logDir = path_1.default.join(__dirname, '..', 'logs');
        const logFile = path_1.default.join(logDir, 'server.log');
        const dirExists = fs_1.default.existsSync(logDir);
        const fileExists = fs_1.default.existsSync(logFile);
        let fileContent = '';
        if (fileExists) {
            fileContent = fs_1.default.readFileSync(logFile, 'utf8').split('\n').slice(-20).join('\n');
        }
        res.json({
            logDirectoryPath: logDir,
            logFilePath: logFile,
            logDirectoryExists: dirExists,
            logFileExists: fileExists,
            lastLogEntries: fileContent,
            currentDirectory: __dirname,
            serverDirectory: path_1.default.join(__dirname, '..')
        });
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            currentDirectory: __dirname
        });
    }
});
// NOTIFICATIONS ENDPOINTS - Super flexible implementation
// GET /api/notifications
app.get('/api/notifications', (req, res) => {
    logToFile('GET /api/notifications received');
    res.json({
        notifications: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 },
        stats: { pending_count: 0, sent_count: 0, failed_count: 0, total_count: 0 }
    });
});
// POST /api/notifications - Accept any format
app.post('/api/notifications', (req, res) => {
    logToFile('POST /api/notifications received');
    // Try to extract data from various possible formats
    let patient_id, message, type;
    if (req.body) {
        if (typeof req.body === 'string') {
            try {
                const parsed = JSON.parse(req.body);
                patient_id = parsed.patient_id;
                message = parsed.message;
                type = parsed.type || 'custom';
            }
            catch (e) {
                if (e instanceof Error) {
                    logToFile(`Failed to parse body string: ${e.message}`);
                }
            }
        }
        else {
            patient_id = req.body.patient_id;
            message = req.body.message;
            type = req.body.type || 'custom';
        }
    }
    // If we have raw body data but couldn't parse it
    if (!patient_id && req.rawBody) {
        try {
            const parsed = JSON.parse(req.rawBody);
            patient_id = parsed.patient_id;
            message = parsed.message;
            type = parsed.type || 'custom';
        }
        catch (e) {
            if (e instanceof Error) {
                logToFile(`Failed to parse raw body: ${e.message}`);
            }
        }
    }
    // Log what we extracted
    logToFile(`Extracted data: patient_id=${patient_id}, message=${message}, type=${type}`);
    // Always return success for testing
    res.status(201).json({
        id: 1,
        patient_id: patient_id || 'unknown',
        message: message || 'No message',
        type: type || 'custom',
        status: 'pending',
        created_at: new Date().toISOString()
    });
});
// Not found middleware
app.use((req, res) => {
    logToFile(`Route not found: ${req.method} ${req.url}`);
    res.status(404).json({ message: `Cannot ${req.method} ${req.url}` });
});
// Error handling middleware
app.use((err, req, res, next) => {
    logToFile(`Error: ${err.message}`);
    if (err.stack)
        logToFile(err.stack);
    res.status(500).json({ message: 'Internal server error', error: err.message });
});
// Start server
app.listen(PORT, () => {
    logToFile(`Server running on port ${PORT}`);
    logToFile(`Test endpoint: http://localhost:${PORT}/api/test`);
    logToFile(`Notifications endpoints: http://localhost:${PORT}/api/notifications`);
});
exports.default = app;
