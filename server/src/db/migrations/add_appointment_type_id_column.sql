-- Script per aggiungere la colonna appointment_type_id alla tabella appointments
ALTER TABLE appointments ADD COLUMN appointment_type_id INTEGER;

-- In SQLite non è possibile aggiungere un vincolo di chiave esterna con ALTER TABLE
-- Creiamo un indice per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_appointments_type_id ON appointments(appointment_type_id);

-- Nota: La relazione con appointment_types esiste logicamente ma non è imposta a livello di database
-- SQLite verificherà l'integrità referenziale solo se foreign_keys è abilitato (PRAGMA foreign_keys = ON)