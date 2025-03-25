-- Migrazione per creare la tabella app_settings
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Crea indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);

-- Inserisci le impostazioni di base per Google Calendar se non esistono
INSERT OR IGNORE INTO app_settings (key, value) 
VALUES ('calendar', json_object(
  'googleCalendarEnabled', 0,
  'clientId', '',
  'clientSecret', '',
  'redirectUri', 'http://localhost:3000/auth/google/callback',
  'workingHours', json_object(
    'mondayStart', '09:00',
    'mondayEnd', '18:00',
    'tuesdayStart', '09:00',
    'tuesdayEnd', '18:00',
    'wednesdayStart', '09:00',
    'wednesdayEnd', '18:00',
    'thursdayStart', '09:00',
    'thursdayEnd', '18:00',
    'fridayStart', '09:00',
    'fridayEnd', '18:00',
    'saturdayStart', '',
    'saturdayEnd', '',
    'sundayStart', '',
    'sundayEnd', ''
  )
));