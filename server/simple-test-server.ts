import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

// Create a minimal Express app
const app = express();
const PORT = 3001; // Use the same port as your main server

// Essential middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Basic logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: "SlabsLink API Server", 
    status: "running", 
    endpoints: ["/api/test", "/api/notifications"] 
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  console.log('Test endpoint called');
  res.json({ message: 'API server is running correctly', timestamp: new Date().toISOString() });
});

// Simple test endpoint
app.get('/test', (req, res) => {
  res.send('Endpoint di test funzionante!');
});

// NOTIFICATIONS ENDPOINTS
// GET /api/notifications
app.get('/api/notifications', (req, res) => {
  console.log('GET /api/notifications received');
  res.json({
    notifications: [],
    pagination: { page: 1, limit: 10, total: 0, pages: 0 },
    stats: { pending_count: 0, sent_count: 0, failed_count: 0, total_count: 0 }
  });
});

// POST /api/notifications
app.post('/api/notifications', (req, res) => {
  console.log('POST /api/notifications received with body:', req.body);
  const { patient_id, message, type = 'custom' } = req.body;
  
  if (!patient_id || !message) {
    return res.status(400).json({ message: 'Patient ID and message are required' });
  }
  
  // Success response
  res.status(201).json({ 
    id: 1,
    patient_id,
    message,
    type,
    status: 'pending',
    created_at: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Test endpoint: http://localhost:${PORT}/api/test`);
  console.log(`Notifications endpoints: http://localhost:${PORT}/api/notifications`);
});