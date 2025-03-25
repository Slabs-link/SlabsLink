import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';

// Crea un'app Express minimale
const app = express();
const PORT = 3002;

// Middleware essenziali
app.use(cors({
  origin: '*', // Consenti richieste da qualsiasi origine
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Log di tutte le richieste
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Servi il file HTML per test
app.get('/', (req, res) => {
  const htmlPath = path.join(__dirname, 'test-notifications.html');
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.send(`
      <html>
        <head><title>Test Server</title></head>
        <body>
          <h1>Test Server Running</h1>
          <p>The test-notifications.html file was not found. Please make sure it exists at: ${htmlPath}</p>
          <p>API endpoints available:</p>
          <ul>
            <li><a href="/api/notifications">GET /api/notifications</a></li>
            <li>POST /api/notifications (use the HTML test page)</li>
          </ul>
        </body>
      </html>
    `);
  }
});

// Endpoint di test
app.get('/test', (req, res) => {
  res.json({ message: 'Test server is running' });
});

// Endpoint notifiche
app.get('/api/notifications', (req, res) => {
  console.log('GET /api/notifications ricevuto');
  
  // Controlla se la richiesta proviene da un browser che si aspetta HTML
  const acceptHeader = req.headers.accept || '';
  if (acceptHeader.includes('text/html') && !req.xhr && !req.headers['content-type']?.includes('application/json')) {
    // Invia una pagina HTML per le richieste dirette dal browser
    res.send(`
      <html>
        <head><title>Notifications API</title></head>
        <body>
          <h1>Notifications API</h1>
          <p>This is a JSON API endpoint. The response is:</p>
          <pre style="background:#f0f0f0; padding:10px; border:1px solid #ddd;">
{
  "notifications": [],
  "pagination": { "page": 1, "limit": 10, "total": 0, "pages": 0 }
}
          </pre>
          <p>To test this API properly, use the <a href="/">test interface</a>.</p>
        </body>
      </html>
    `);
  } else {
    // Invia JSON per le richieste API
    res.json({
      notifications: [],
      pagination: { page: 1, limit: 10, total: 0, pages: 0 }
    });
  }
});

app.post('/api/notifications', (req, res) => {
  console.log('POST /api/notifications ricevuto');
  console.log('Body:', req.body);
  
  // Salva la richiesta in un file per debug
  fs.writeFileSync(
    'notification-request.json', 
    JSON.stringify({
      timestamp: new Date().toISOString(),
      headers: req.headers,
      body: req.body
    }, null, 2)
  );
  
  res.status(201).json({
    id: 1,
    patient_id: req.body.patient_id || 'unknown',
    message: req.body.message || 'No message',
    status: 'pending',
    created_at: new Date().toISOString()
  });
});

// Avvia il server
app.listen(PORT, () => {
  console.log(`Test server in esecuzione su http://localhost:${PORT}`);
  console.log(`Endpoint notifiche: http://localhost:${PORT}/api/notifications`);
  console.log(`Per testare, apri http://localhost:${PORT} nel browser`);
});