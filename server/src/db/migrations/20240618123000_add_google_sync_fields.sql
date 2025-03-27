-- Migrazione per aggiungere campi di sincronizzazione Google

-- Aggiungi colonna google_event_id alla tabella appointments
ALTER TABLE appointments
ADD COLUMN google_event_id TEXT;

-- Aggiungi colonna sync_status alla tabella appointments
ALTER TABLE appointments
ADD COLUMN sync_status TEXT CHECK(sync_status IN ('synced', 'pending', 'failed')) DEFAULT 'pending';