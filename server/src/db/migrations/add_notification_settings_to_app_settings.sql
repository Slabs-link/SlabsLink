-- Migrazione per aggiungere le impostazioni di notifica per Google Calendar

-- Inserisci le impostazioni di notifica per Google Calendar se non esistono già
INSERT OR IGNORE INTO app_settings (key, value) 
VALUES ('calendar_notifications', json_object(
  'enabled', 0,
  'notifyOnCreate', 1,
  'notifyOnUpdate', 1,
  'notifyOnDelete', 1,
  'notifyBeforeAppointment', 1,
  'notifyBeforeMinutes', 30
));