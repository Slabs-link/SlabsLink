CREATE TABLE IF NOT EXISTS appointment_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Inserisci alcuni tipi di appuntamento predefiniti
INSERT INTO appointment_types (name, description) 
SELECT 'Prima visita', 'Prima visita con il paziente'
WHERE NOT EXISTS (SELECT 1 FROM appointment_types WHERE name = 'Prima visita');

INSERT INTO appointment_types (name, description) 
SELECT 'Visita di controllo', 'Visita di controllo periodica'
WHERE NOT EXISTS (SELECT 1 FROM appointment_types WHERE name = 'Visita di controllo');

INSERT INTO appointment_types (name, description) 
SELECT 'Follow-up', 'Visita di follow-up dopo un trattamento'
WHERE NOT EXISTS (SELECT 1 FROM appointment_types WHERE name = 'Follow-up');

-- Crea indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_appointment_types_name ON appointment_types(name);