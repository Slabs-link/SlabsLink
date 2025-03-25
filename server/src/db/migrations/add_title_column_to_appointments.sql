-- Script per aggiungere la colonna title alla tabella appointments
ALTER TABLE appointments ADD COLUMN title TEXT NOT NULL DEFAULT 'Appuntamento';

-- Aggiorna gli indici se necessario
CREATE INDEX IF NOT EXISTS idx_appointments_title ON appointments(title);