=== STRUTTURA DEL DATABASE ===

Database: server/data/slabs.db


--- TABELLA: users ---
CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT UNIQUE, phone TEXT, birth_date TEXT, gender TEXT, fiscal_code TEXT, address TEXT, city TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) , birth_city_code VARCHAR(10), birth_city TEXT)

Colonne:
id (INTEGER) NULL  PRIMARY KEY
first_name (TEXT) NOT NULL
last_name (TEXT) NOT NULL
email (TEXT) NULL
phone (TEXT) NULL
birth_date (TEXT) NULL
gender (TEXT) NULL
fiscal_code (TEXT) NULL
address (TEXT) NULL
city (TEXT) NULL
created_at (TEXT) NULL DEFAULT datetime('now')
updated_at (TEXT) NULL DEFAULT datetime('now')
birth_city_code (VARCHAR(10)) NULL
birth_city (TEXT) NULL

Indici:
sqlite_autoindex_users_1 (email) UNIQUE

Foreign Keys:
  Nessuna foreign key definita

Numero di righe: 3

--- TABELLA: notification_templates ---
CREATE TABLE notification_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL, content TEXT NOT NULL, description TEXT, is_system INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))

Colonne:
id (INTEGER) NULL  PRIMARY KEY
name (TEXT) NOT NULL
type (TEXT) NOT NULL
content (TEXT) NOT NULL
description (TEXT) NULL
is_system (INTEGER) NULL DEFAULT 0
created_at (TEXT) NULL DEFAULT datetime('now')
updated_at (TEXT) NULL DEFAULT datetime('now')

Indici:
  Nessun indice definito

Foreign Keys:
  Nessuna foreign key definita

Numero di righe: 4

--- TABELLA: notifications ---
CREATE TABLE notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, message TEXT NOT NULL, status TEXT DEFAULT 'pending', error_message TEXT, template_id INTEGER, appointment_id INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (template_id) REFERENCES notification_templates(id), FOREIGN KEY (appointment_id) REFERENCES appointments(id))

Colonne:
id (INTEGER) NULL  PRIMARY KEY
user_id (INTEGER) NOT NULL
message (TEXT) NOT NULL
status (TEXT) NULL DEFAULT 'pending'
error_message (TEXT) NULL
template_id (INTEGER) NULL
appointment_id (INTEGER) NULL
created_at (TEXT) NULL DEFAULT datetime('now')
updated_at (TEXT) NULL DEFAULT datetime('now')

Indici:
  Nessun indice definito

Foreign Keys:
  appointment_id -> appointments(id)
  template_id -> notification_templates(id)
  user_id -> users(id)

Numero di righe: 1

--- TABELLA: app_settings ---
CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))

Colonne:
key (TEXT) NULL  PRIMARY KEY
value (TEXT) NOT NULL
created_at (TEXT) NULL DEFAULT datetime('now')
updated_at (TEXT) NULL DEFAULT datetime('now')

Indici:
idx_app_settings_key (key)
sqlite_autoindex_app_settings_1 (key) UNIQUE

Foreign Keys:
  Nessuna foreign key definita

Numero di righe: 6

--- TABELLA: comuni ---
CREATE TABLE comuni (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, codice TEXT NOT NULL, provincia TEXT NOT NULL)

Colonne:
id (INTEGER) NULL  PRIMARY KEY
nome (TEXT) NOT NULL
codice (TEXT) NOT NULL
provincia (TEXT) NOT NULL

Indici:
  Nessun indice definito

Foreign Keys:
  Nessuna foreign key definita

Numero di righe: 7896

--- TABELLA: appointment_types ---
CREATE TABLE appointment_types (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))

Colonne:
id (INTEGER) NULL  PRIMARY KEY
name (TEXT) NOT NULL
description (TEXT) NULL
created_at (TEXT) NULL DEFAULT datetime('now')
updated_at (TEXT) NULL DEFAULT datetime('now')

Indici:
idx_appointment_types_name (name)

Foreign Keys:
  Nessuna foreign key definita

Numero di righe: 3

--- TABELLA: licenses ---
CREATE TABLE licenses (id TEXT PRIMARY KEY, key TEXT UNIQUE NOT NULL, expiration_date TEXT NOT NULL, features TEXT NOT NULL, active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))

Colonne:
id (TEXT) NULL  PRIMARY KEY
key (TEXT) NOT NULL
expiration_date (TEXT) NOT NULL
features (TEXT) NOT NULL
active (INTEGER) NULL DEFAULT 1
created_at (TEXT) NULL DEFAULT datetime('now')
updated_at (TEXT) NULL DEFAULT datetime('now')

Indici:
sqlite_autoindex_licenses_2 (key) UNIQUE
sqlite_autoindex_licenses_1 (id) UNIQUE

Foreign Keys:
  Nessuna foreign key definita

Numero di righe: 1

--- TABELLA: appointments ---
CREATE TABLE "appointments" ("id" INTEGER, "date" TEXT, "time" TEXT, "patient_id" TEXT, "notes" TEXT, "calendar_id" TEXT, "last_sync_time" TEXT, "sync_error" TEXT, "status" INTEGER, "appointment_type_id" INTEGER, "title" TEXT, "duration" INTEGER, "synced" INTEGER, "google_calendar_event_id" TEXT, google_event_id TEXT, sync_status TEXT CHECK(sync_status IN ('synced', 'pending', 'failed')) DEFAULT 'pending', PRIMARY KEY("id"))

Colonne:
id (INTEGER) NULL  PRIMARY KEY
date (TEXT) NULL
time (TEXT) NULL
patient_id (TEXT) NULL
notes (TEXT) NULL
calendar_id (TEXT) NULL
last_sync_time (TEXT) NULL
sync_error (TEXT) NULL
status (INTEGER) NULL
appointment_type_id (INTEGER) NULL
title (TEXT) NULL
duration (INTEGER) NULL
synced (INTEGER) NULL
google_calendar_event_id (TEXT) NULL
google_event_id (TEXT) NULL
sync_status (TEXT) NULL DEFAULT 'pending'

Indici:
  Nessun indice definito

Foreign Keys:
  Nessuna foreign key definita

Numero di righe: 3

--- TABELLA: appointments_temp ---
CREATE TABLE appointments_temp (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, time TEXT NOT NULL, patient TEXT NOT NULL, notes TEXT, calendar_id TEXT, last_sync_time TEXT, sync_error TEXT)

Colonne:
id (INTEGER) NULL  PRIMARY KEY
date (TEXT) NOT NULL
time (TEXT) NOT NULL
patient (TEXT) NOT NULL
notes (TEXT) NULL
calendar_id (TEXT) NULL
last_sync_time (TEXT) NULL
sync_error (TEXT) NULL

Indici:
  Nessun indice definito

Foreign Keys:
  Nessuna foreign key definita

Numero di righe: 0

=== FINE STRUTTURA DEL DATABASE ===