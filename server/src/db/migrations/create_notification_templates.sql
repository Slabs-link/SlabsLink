CREATE TABLE IF NOT EXISTS notification_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Inserimento dei template di sistema predefiniti
INSERT INTO notification_templates (name, description, content, type, is_system) VALUES
(
  'Nuovo Appuntamento', 
  'Notifica per un nuovo appuntamento creato', 
  'Gentile {{patient_name}}, le confermiamo che è stato fissato un nuovo appuntamento per {{appointment_title}} in data {{appointment_date}} alle ore {{appointment_time}}. La aspettiamo!', 
  'appointment_confirmation',
  TRUE
),
(
  'Cancellazione Appuntamento', 
  'Notifica per un appuntamento cancellato', 
  'Gentile {{patient_name}}, le comunichiamo che l''appuntamento per {{appointment_title}} previsto per il {{appointment_date}} alle ore {{appointment_time}} è stato cancellato. Per maggiori informazioni o per fissare un nuovo appuntamento, la preghiamo di contattarci.', 
  'appointment_cancellation',
  TRUE
),
(
  'Modifica Appuntamento', 
  'Notifica per un appuntamento modificato', 
  'Gentile {{patient_name}}, le comunichiamo che l''appuntamento per {{appointment_title}} è stato modificato. Il nuovo appuntamento è fissato per il {{appointment_date}} alle ore {{appointment_time}}. La aspettiamo!', 
  'appointment_update',
  TRUE
),
(
  'Notifica Google Calendar', 
  'Notifica per un appuntamento creato da Google Calendar', 
  'Gentile {{patient_name}}, le confermiamo che è stato fissato un nuovo appuntamento tramite Google Calendar per {{appointment_title}} in data {{appointment_date}} alle ore {{appointment_time}}. La aspettiamo!', 
  'google_calendar_confirmation',
  TRUE
),
(
  'Auguri Natalizi', 
  'Messaggio di auguri per Natale', 
  'Gentile {{patient_name}}, lo staff di SlabsLink le augura un sereno Natale e felici festività!', 
  'christmas_wishes',
  TRUE
),
(
  'Auguri Nuovo Anno', 
  'Messaggio di auguri per il nuovo anno', 
  'Gentile {{patient_name}}, lo staff di SlabsLink le augura un felice anno nuovo pieno di salute e serenità!', 
  'new_year_wishes',
  TRUE
);