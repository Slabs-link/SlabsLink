-- Crea tabella app_settings
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);

-- Impostazioni iniziali per Google Calendar
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

-- Aggiungi calendar_id agli appuntamenti
-- Modifica colonne in modo idempotente per SQLite

CREATE TABLE IF NOT EXISTS appointments_temp (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  patient TEXT NOT NULL,
  notes TEXT,
  calendar_id TEXT,
  last_sync_time TEXT,
  sync_error TEXT
);

INSERT OR REPLACE INTO appointments_temp
SELECT DISTINCT a.id, a.date, a.time, a.patient, a.notes,
  NULL AS calendar_id, 
  NULL AS last_sync_time, 
  NULL AS sync_error
FROM appointments a
JOIN users u ON 
  a.patient = u.first_name || ' ' || u.last_name
  AND u.id = (SELECT id FROM users WHERE first_name || ' ' || last_name = a.patient LIMIT 1);

DROP TABLE appointments;

ALTER TABLE appointments_temp RENAME TO appointments;

-- Ricrea indici dopo modifica struttura
CREATE INDEX IF NOT EXISTS idx_appointments_calendar_id ON appointments(calendar_id);

-- Impostazioni notifiche
INSERT OR IGNORE INTO app_settings (key, value)
VALUES ('calendar_notifications', json_object(
  'enabled', 0,
  'notifyOnCreate', 1,
  'notifyOnUpdate', 1,
  'notifyOnDelete', 1,
  'notifyBeforeAppointment', 1,
  'notifyBeforeMinutes', 30
));

-- Aggiungi colonne color e reminder_sent
CREATE TABLE IF NOT EXISTS appointments_temp AS SELECT id, date, time, patient, notes, calendar_id, last_sync_time, sync_error FROM appointments LIMIT 0;

INSERT INTO appointments_temp (id, date, time, patient, notes, calendar_id, last_sync_time, sync_error)
SELECT id, date, time, patient, notes, calendar_id, last_sync_time, sync_error
FROM appointments;

DROP TABLE appointments;

ALTER TABLE appointments_temp RENAME TO appointments;