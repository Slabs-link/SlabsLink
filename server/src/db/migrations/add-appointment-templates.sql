-- Aggiungi template per le notifiche degli appuntamenti

-- Template per la conferma dell'appuntamento
INSERT INTO notification_templates (name, type, content)
VALUES (
  'Conferma Appuntamento', 
  'appointment_confirmation', 
  'Gentile {{first_name}} {{last_name}}, confermiamo il suo appuntamento per il giorno {{appointment_date}} alle ore {{appointment_time}}. Grazie.'
);

-- Template per l'aggiornamento dell'appuntamento
INSERT INTO notification_templates (name, type, content)
VALUES (
  'Aggiornamento Appuntamento', 
  'appointment_update', 
  'Gentile {{first_name}} {{last_name}}, il suo appuntamento è stato aggiornato per il giorno {{appointment_date}} alle ore {{appointment_time}}. Grazie.'
);

-- Template per la cancellazione dell'appuntamento
INSERT INTO notification_templates (name, type, content)
VALUES (
  'Cancellazione Appuntamento', 
  'appointment_cancellation', 
  'Gentile {{first_name}} {{last_name}}, il suo appuntamento del giorno {{appointment_date}} alle ore {{appointment_time}} è stato cancellato. Ci scusiamo per l\'inconveniente.'
);