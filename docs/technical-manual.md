# Manuale Tecnico SlabsLink

## Indice
1. [Struttura del Progetto e Relazioni tra File](#struttura-del-progetto-e-relazioni-tra-file)
2. [Database e Schema delle Tabelle](#database-e-schema-delle-tabelle)
3. [Funzionalità Implementate](#funzionalità-implementate)
4. [Interfaccia Utente e Componenti](#interfaccia-utente-e-componenti)
5. [Avvio dei Server](#avvio-dei-server)

## Struttura del Progetto e Relazioni tra File

### Struttura delle Directory

```
SlabsLink/
├── client/                 # Frontend React
│   └── src/
│       ├── components/     # Componenti UI React
│       ├── models/         # Modelli dati
│       └── services/       # Servizi business logic
├── server/                 # Backend Node.js
│   ├── src/
│   │   ├── controllers/   # Controller API
│   │   ├── models/        # Modelli database
│   │   ├── routes/        # Route API
│   │   └── services/      # Servizi business logic
│   └── data/              # File di dati e database
└── tools/                 # Strumenti di supporto
    └── license-generator/ # Generatore licenze
```

### Relazioni tra File Principali

#### Frontend (client/src/)

- **App.tsx**: Entry point dell'applicazione React
  - Gestisce il routing principale
  - Importa e utilizza i componenti principali
  - Gestisce lo stato globale dell'applicazione

- **components/setup/SetupWizard.tsx**:
  - Gestisce la configurazione iniziale dell'applicazione
  - Dipende da:
    - services/auth.service.ts (validazione licenza)
    - services/whatsapp.service.ts (configurazione WhatsApp)
    - services/google-calendar.service.ts (setup Google Calendar)

- **components/dashboard/Dashboard.tsx**:
  - Layout principale dopo il login
  - Dipende da:
    - components/calendar/CalendarView.tsx
    - components/patients/PatientList.tsx
    - components/notifications/NotificationCenter.tsx

#### Backend (server/src/)

- **index.ts**: Entry point del server
  - Configura Express e middleware
  - Inizializza le connessioni al database
  - Carica le route API

- **routes/appointments.ts**:
  - Definisce le API per la gestione appuntamenti
  - Dipende da:
    - controllers/appointments.controller.ts
    - models/appointment.model.ts

- **services/whatsapp.service.ts**:
  - Gestisce l'integrazione con WhatsApp
  - Dipende da:
    - models/appointment.model.ts (per le notifiche)
    - models/patient.model.ts (per i dati dei pazienti)

## Database e Schema delle Tabelle

### Schema del Database

#### Tabella: users
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Tabella: patients
```sql
CREATE TABLE patients (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    codice_fiscale VARCHAR(16) UNIQUE NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    birth_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Tabella: appointments
```sql
CREATE TABLE appointments (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(id),
    date_time TIMESTAMP NOT NULL,
    duration INTEGER NOT NULL, -- in minutes
    notes TEXT,
    status VARCHAR(20) NOT NULL,
    google_calendar_event_id VARCHAR(100),
    whatsapp_notification_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Tabella: license
```sql
CREATE TABLE license (
    id SERIAL PRIMARY KEY,
    license_key VARCHAR(255) UNIQUE NOT NULL,
    activation_date TIMESTAMP NOT NULL,
    expiry_date TIMESTAMP NOT NULL,
    features JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Relazioni tra Tabelle

- **appointments → patients**: Ogni appuntamento è associato a un paziente (foreign key patient_id)
- **appointments → users**: Gli appuntamenti possono essere gestiti dagli utenti del sistema

## Funzionalità Implementate

### License Generator

Il License Generator è uno strumento standalone che genera chiavi di licenza valide per l'applicazione.

#### Funzionamento
1. Generazione chiave univoca nel formato XXXXX-XXXXX-XXXXX-XXXXX
2. Crittografia della chiave con algoritmo AES-256
3. Salvataggio nel database con data di attivazione e scadenza
4. Esportazione della chiave in formato JSON per il cliente

#### Utilizzo
```bash
node tools/license-generator/license-generator.js --duration 365 --features all
```

### Setup Wizard

Il Setup Wizard guida l'utente attraverso la configurazione iniziale dell'applicazione.

#### Fasi di Setup

1. **Attivazione Licenza**
   - Validazione della chiave di licenza
   - Verifica delle funzionalità incluse
   - Test della connessione al database

2. **Integrazione WhatsApp**
   - Configurazione percorso browser Chrome
   - Impostazione directory dati WhatsApp
   - Test della connessione WhatsApp

3. **Setup Google Calendar**
   - Inserimento credenziali Google API
   - Configurazione URI di redirect
   - Verifica dell'autenticazione

## Interfaccia Utente e Componenti

### Pagine Principali

#### Login (/login)
- Form di autenticazione
- Validazione credenziali
- Reindirizzamento al setup wizard se necessario

#### Dashboard (/dashboard)
- Vista calendario appuntamenti
- Lista pazienti con ricerca
- Centro notifiche WhatsApp
- Statistiche e report

#### Gestione Pazienti (/patients)
- Lista pazienti con filtri
- Form creazione/modifica paziente
- Storico appuntamenti per paziente

#### Gestione Appuntamenti (/appointments)
- Calendario interattivo
- Form creazione/modifica appuntamento
- Sincronizzazione Google Calendar
- Invio notifiche WhatsApp

#### Impostazioni (/settings)
- Configurazione notifiche
- Gestione integrazioni
- Backup e ripristino

### Funzionalità per Pagina

#### Dashboard
- **Calendario**
  - Vista giornaliera/settimanale/mensile
  - Drag & drop appuntamenti
  - Popup dettagli rapidi

- **Lista Pazienti**
  - Ricerca per nome/codice fiscale
  - Filtri per stato
  - Azioni rapide

- **Centro Notifiche**
  - Stato connessione WhatsApp
  - Coda notifiche
  - Log invii

#### Gestione Pazienti
- **Form Paziente**
  - Validazione codice fiscale
  - Upload documenti
  - Storico modifiche

- **Storico Appuntamenti**
  - Timeline appuntamenti
  - Statistiche presenza
  - Note e documenti

#### Gestione Appuntamenti
- **Form Appuntamento**
  - Selezione paziente con autocompletamento
  - Verifica disponibilità
  - Impostazione durata e tipo

- **Notifiche**
  - Template personalizzabili
  - Scheduling automatico
  - Conferme e promemoria

## Avvio dei Server

### Frontend (Development)

```bash
# Dalla directory principale
cd client
npm install
npm run dev
```

Il server di sviluppo sarà disponibile su http://localhost:5173

### Backend

```bash
# Dalla directory principale
cd server
npm install
npm run dev
```

Il server API sarà disponibile su http://localhost:3001

### Produzione

1. Build del frontend:
```bash
cd client
npm run build
```

2. Avvio del backend:
```bash
cd server
npm start
```

L'applicazione sarà disponibile su http://localhost:3001