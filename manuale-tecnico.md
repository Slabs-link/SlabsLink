# Manuale Tecnico SlabsLink

## Indice
1. [Introduzione](#introduzione)
2. [Struttura del Progetto](#struttura-del-progetto)
3. [Struttura del Database](#struttura-del-database)
4. [Setup Iniziale](#setup-iniziale)
5. [Generatore di Licenze](#generatore-di-licenze)
6. [Integrazioni Esterne](#integrazioni-esterne)
7. [Manutenzione e Modifiche](#manutenzione-e-modifiche)

## Introduzione

SlabsLink è un sistema di gestione appuntamenti che integra funzionalità di calendario, gestione pazienti, notifiche automatiche e sincronizzazione con servizi esterni. Il sistema è progettato per funzionare in ambiente locale, con un database SQLite per la persistenza dei dati e include integrazioni opzionali con Google Calendar e WhatsApp per la sincronizzazione degli appuntamenti e l'invio di notifiche.

## Struttura del Progetto

Il progetto è organizzato secondo una struttura modulare che separa chiaramente le diverse responsabilità dell'applicazione:

```
src/
├── components/         # Componenti UI React
│   ├── appointments/   # Componenti per la gestione degli appuntamenti
│   ├── calendar/       # Componenti per la visualizzazione del calendario
│   ├── common/         # Componenti comuni riutilizzabili
│   ├── dashboard/      # Componenti per la dashboard principale
│   ├── layout/         # Componenti di layout dell'applicazione
│   ├── notifications/  # Componenti per la gestione delle notifiche
│   ├── patients/       # Componenti per la gestione dei pazienti
│   ├── settings/       # Componenti per le impostazioni
│   ├── setup/          # Componenti per il wizard di configurazione
│   ├── system/         # Componenti di sistema (es. LicenseAlert)
│   ├── templates/      # Componenti per i template di notifica
│   └── users/          # Componenti per la gestione degli utenti
├── models/             # Modelli di dati e interazione con DB
├── server/             # Codice lato server
│   ├── api/            # API endpoints
│   ├── database/       # Gestione database
│   ├── models/         # Modelli server
│   ├── routes/         # Definizione delle rotte
│   ├── server.ts       # Entry point del server
│   └── services/       # Servizi lato server
├── services/           # Servizi di business logic
├── theme/              # Configurazione del tema UI
├── types/              # Definizioni di tipi TypeScript
├── App.tsx             # Componente principale e routing
└── main.tsx            # Entry point dell'applicazione

tools/                  # Strumenti di utilità
├── license-generator-sqlite.js  # Generatore di licenze (versione SQLite)
├── license-generator.js         # Generatore di licenze (versione JavaScript)
└── license-generator.ts         # Generatore di licenze (versione TypeScript)
```

### File Principali

- **App.tsx**: Componente principale che gestisce il routing dell'applicazione
- **server/server.ts**: Entry point del server backend
- **components/setup/SetupWizard.tsx**: Wizard di configurazione iniziale
- **models/license.model.ts**: Gestione delle licenze
- **tools/license-generator-sqlite.js**: Strumento per generare licenze

## Struttura del Database

Il database SQLite contiene le seguenti tabelle:

### Tabella: users
Gestisce gli utenti del sistema.

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | INTEGER (PRIMARY KEY) | Identificativo univoco dell'utente |
| first_name | TEXT | Nome dell'utente |
| last_name | TEXT | Cognome dell'utente |
| email | TEXT | Email dell'utente |
| phone | TEXT | Numero di telefono |
| birth_date | TEXT | Data di nascita |
| gender | TEXT | Genere |
| fiscal_code | TEXT | Codice fiscale |
| address | TEXT | Indirizzo |
| city | TEXT | Città |
| created_at | TEXT | Data di creazione del record |
| updated_at | TEXT | Data di ultimo aggiornamento |
| birth_city_code | VARCHAR(10) | Codice della città di nascita |
| birth_city | TEXT | Nome della città di nascita |

### Tabella: notification_templates
Contiene i template per le notifiche.

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | INTEGER (PRIMARY KEY) | Identificativo univoco del template |
| name | TEXT | Nome del template |
| type | TEXT | Tipo di template |
| content | TEXT | Contenuto del template |
| description | TEXT | Descrizione del template |
| is_system | INTEGER | Flag che indica se è un template di sistema |
| created_at | TEXT | Data di creazione |
| updated_at | TEXT | Data di ultimo aggiornamento |

### Tabella: notifications
Registra le notifiche inviate.

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | INTEGER (PRIMARY KEY) | Identificativo univoco della notifica |
| user_id | INTEGER | ID dell'utente destinatario |
| message | TEXT | Messaggio della notifica |
| status | TEXT | Stato della notifica |
| error_message | TEXT | Messaggio di errore (se presente) |
| template_id | INTEGER | ID del template utilizzato |
| appointment_id | INTEGER | ID dell'appuntamento associato |
| created_at | TEXT | Data di creazione |
| updated_at | TEXT | Data di ultimo aggiornamento |

### Tabella: appointment_types
Definisce i tipi di appuntamento disponibili.

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | INTEGER (PRIMARY KEY) | Identificativo univoco del tipo |
| name | TEXT | Nome del tipo di appuntamento |
| description | TEXT | Descrizione del tipo |
| created_at | TEXT | Data di creazione |
| updated_at | TEXT | Data di ultimo aggiornamento |

### Tabella: comuni
Contiene i comuni italiani per la gestione dei codici fiscali.

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | INTEGER (PRIMARY KEY) | Identificativo univoco del comune |
| nome | TEXT | Nome del comune |
| codice | TEXT | Codice catastale del comune |
| provincia | TEXT | Provincia di appartenenza |

### Tabella: appointments_temp
Tabella temporanea per gli appuntamenti in fase di sincronizzazione.

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | INTEGER (PRIMARY KEY) | Identificativo univoco |
| date | TEXT | Data dell'appuntamento |
| time | TEXT | Ora dell'appuntamento |
| patient | TEXT | Nome del paziente |
| notes | TEXT | Note sull'appuntamento |
| calendar_id | TEXT | ID del calendario esterno |
| last_sync_time | TEXT | Timestamp dell'ultima sincronizzazione |
| sync_error | TEXT | Errore di sincronizzazione (se presente) |

### Tabella: user_files
Gestisce i file caricati dagli utenti.

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | INTEGER (PRIMARY KEY) | Identificativo univoco del file |
| user_id | INTEGER | ID dell'utente proprietario |
| file_name | TEXT | Nome del file nel sistema |
| original_name | TEXT | Nome originale del file |
| file_path | TEXT | Percorso del file |
| file_type | TEXT | Tipo MIME del file |
| file_size | INTEGER | Dimensione del file in byte |
| description | TEXT | Descrizione del file |
| created_at | TIMESTAMP | Data di caricamento |
| updated_at | TIMESTAMP | Data di ultimo aggiornamento |

### Tabella: appointments
Gestisce gli appuntamenti.

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | INTEGER (PRIMARY KEY) | Identificativo univoco dell'appuntamento |
| date | TEXT | Data dell'appuntamento |
| time | TEXT | Ora dell'appuntamento |
| patient_id | TEXT | ID del paziente |
| notes | TEXT | Note sull'appuntamento |
| calendar_id | TEXT | ID del calendario esterno |
| last_sync_time | TEXT | Timestamp dell'ultima sincronizzazione |
| sync_error | TEXT | Errore di sincronizzazione (se presente) |
| status | INTEGER | Stato dell'appuntamento |
| appointment_type_id | INTEGER | Tipo di appuntamento |
| title | TEXT | Titolo dell'appuntamento |
| duration | INTEGER | Durata in minuti |
| synced | INTEGER | Flag di sincronizzazione |
| google_calendar_event_id | TEXT | ID dell'evento in Google Calendar |
| google_event_id | TEXT | ID alternativo dell'evento Google |
| sync_status | TEXT | Stato della sincronizzazione |

### Tabella: licenses
Gestisce le licenze del software.

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | TEXT (PRIMARY KEY) | Identificativo univoco della licenza |
| key | TEXT | Chiave di licenza |
| expiration_date | TEXT | Data di scadenza |
| features | TEXT | Funzionalità abilitate (JSON) |
| active | INTEGER | Stato di attivazione |
| created_at | TEXT | Data di creazione |
| updated_at | TEXT | Data di ultimo aggiornamento |

### Tabella: app_settings
Contiene le impostazioni dell'applicazione.

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| key | TEXT (PRIMARY KEY) | Chiave dell'impostazione |
| value | TEXT | Valore dell'impostazione |
| created_at | TEXT | Data di creazione |
| updated_at | TEXT | Data di ultimo aggiornamento |

## Setup Iniziale

Il sistema include un wizard di configurazione per la configurazione iniziale dell'applicazione, implementato come componente React in `src/components/setup/SetupWizard.tsx`.

### Processo di Setup

Il wizard guida l'utente attraverso i seguenti passaggi:

1. **Attivazione Licenza**: Caricamento e validazione del file di licenza
2. **Informazioni Aziendali**: Configurazione dei dati dell'azienda
3. **Integrazione WhatsApp** (opzionale): Setup delle notifiche WhatsApp se la licenza lo permette
4. **Configurazione Google Calendar** (opzionale): Setup dell'integrazione con Google Calendar se la licenza lo permette

### Utilizzo del Setup Wizard

1. **Avvio del Setup**:
   - Al primo avvio dell'applicazione, viene verificato se il setup è stato completato
   - Se non è stato completato, l'utente viene reindirizzato automaticamente alla pagina di setup
   - In alternativa, è possibile accedere al setup tramite la rotta `/setup`

2. **Attivazione della Licenza**:
   - L'utente deve caricare un file di licenza valido (formato JSON)
   - Il sistema verifica la validità della licenza e le funzionalità abilitate
   - Se la licenza è valida, l'utente può procedere al passaggio successivo

3. **Configurazione delle Informazioni Aziendali**:
   - L'utente inserisce il nome dell'azienda e altre informazioni di base
   - Questi dati vengono utilizzati nei report e nelle comunicazioni

4. **Configurazione delle Integrazioni** (se abilitate dalla licenza):
   - **WhatsApp**: Configurazione del percorso del browser e del percorso dati
   - **Google Calendar**: Configurazione delle credenziali OAuth2 (Client ID, Client Secret, URI di reindirizzamento)

5. **Completamento del Setup**:
   - Le configurazioni vengono salvate nel database
   - Viene creato un marker che indica che il setup è stato completato
   - L'utente viene reindirizzato alla dashboard

### Reset del Setup

In alcune situazioni potrebbe essere necessario resettare il setup dell'applicazione:

1. **Eliminazione Manuale del Marker**:
   - Eliminare il flag `setupComplete` da localStorage
   - Riavviare l'applicazione

2. **Reset Completo**:
   - Eliminare il database SQLite o ripristinarlo a uno stato iniziale
   - Eliminare il flag `setupComplete` da localStorage
   - Riavviare l'applicazione

## Generatore di Licenze

Il sistema include uno strumento per la generazione e gestione delle licenze, implementato in `tools/license-generator-sqlite.js`.

### Funzionalità del Generatore di Licenze

- Generazione di nuove licenze con data di scadenza configurabile
- Attivazione/disattivazione di funzionalità specifiche (WhatsApp, Google Calendar)
- Visualizzazione di tutte le licenze esistenti
- Disattivazione di licenze esistenti
- Creazione automatica della tabella delle licenze se non esiste

### Struttura delle Licenze

Ogni licenza contiene le seguenti informazioni:

- **ID**: Identificativo univoco della licenza (UUID)
- **Chiave**: Chiave di licenza nel formato XXXXX-XXXXX-XXXXX-XXXXX
- **Data di Scadenza**: Data di scadenza della licenza
- **Funzionalità**: Oggetto JSON che specifica quali funzionalità sono abilitate
  - `whatsappIntegration`: Abilita l'integrazione con WhatsApp
  - `googleCalendarIntegration`: Abilita l'integrazione con Google Calendar
- **Stato**: Attivo o inattivo

### Utilizzo del Generatore di Licenze

1. **Avvio del Generatore**:
   ```bash
   node tools/license-generator-sqlite.js
   ```

2. **Menu Principale**:
   - **1. Generate new license**: Crea una nuova licenza
   - **2. List all licenses**: Visualizza tutte le licenze esistenti
   - **3. Deactivate a license**: Disattiva una licenza esistente
   - **4. Exit**: Esce dal programma

3. **Generazione di una Nuova Licenza**:
   - Inserire la data di scadenza nel formato YYYY-MM-DD
   - Specificare se abilitare l'integrazione WhatsApp (y/n)
   - Specificare se abilitare l'integrazione Google Calendar (y/n)
   - Il sistema genera una chiave di licenza casuale
   - Le informazioni della licenza vengono salvate nel database
   - Viene creato un file JSON crittografato con le informazioni della licenza

4. **Visualizzazione delle Licenze**:
   - Il sistema mostra tutte le licenze esistenti con le relative informazioni
   - Per ogni licenza vengono mostrati: chiave, data di scadenza, funzionalità abilitate e stato

5. **Disattivazione di una Licenza**:
   - Inserire la chiave della licenza da disattivare
   - Il sistema imposta lo stato della licenza a inattivo

### File di Licenza

Quando viene generata una nuova licenza, il sistema crea un file JSON nel formato `license-[CHIAVE].json`. Questo file contiene le informazioni della licenza in formato crittografato e può essere distribuito agli utenti per l'attivazione.

Struttura del file di licenza:
```json
{
  "encrypted": true,
  "data": "[DATI_CRITTOGRAFATI]"
}
```

I dati crittografati contengono le seguenti informazioni:
- Chiave di licenza
- Data di scadenza
- Funzionalità abilitate

La crittografia utilizza l'algoritmo AES-256-CBC con una chiave segreta predefinita.

## Integrazioni Esterne

Il sistema supporta due integrazioni esterne principali, abilitate in base alla licenza:

### Google Calendar

L'integrazione con Google Calendar permette la sincronizzazione bidirezionale degli appuntamenti.

**Configurazione**:
1. L'utente deve avere una licenza che include l'integrazione Google Calendar
2. L'utente configura le credenziali OAuth2 (Client ID, Client Secret, URI di reindirizzamento)
3. L'applicazione si autentica con Google

**Sincronizzazione**:
- Gli appuntamenti vengono sincronizzati automaticamente con Google Calendar
- Le modifiche agli appuntamenti vengono propagate a Google Calendar
- Gli appuntamenti eliminati vengono rimossi da Google Calendar

### WhatsApp

L'integrazione con WhatsApp permette l'invio di notifiche automatiche ai pazienti.

**Configurazione**:
1. L'utente deve avere una licenza che include l'integrazione WhatsApp
2. L'utente configura il percorso del browser Chrome/Chromium e il percorso dei dati
3. L'applicazione avvia WhatsApp Web e l'utente scansiona il codice QR

**Notifiche**:
- Conferme di appuntamento: inviate quando viene creato un nuovo appuntamento
- Promemoria: inviati il giorno prima dell'appuntamento
- Notifiche manuali: l'utente può inviare notifiche personalizzate

## Manutenzione e Modifiche

### Aggiunta di Nuove Funzionalità

1. **Nuovi Componenti UI**:
   - Creare il nuovo componente in `src/components/`
   - Aggiungere la rotta in `App.tsx` se necessario
   - Aggiornare la navigazione nei componenti di layout

2. **Nuove Funzionalità di Database**:
   - Aggiungere i nuovi campi/tabelle nel database
   - Creare o aggiornare il modello corrispondente in `src/models/`
   - Aggiornare i servizi che utilizzano il modello

3. **Nuove Integrazioni**:
   - Creare un nuovo servizio in `src/services/`
   - Aggiornare il modello `License` per includere il controllo della nuova funzionalità
   - Aggiungere l'interfaccia utente per la configurazione in `Settings.tsx`

### Gestione delle Licenze

Per modificare il sistema di licenze:

1. Aggiornare `models/license.model.ts` con i nuovi tipi di licenza o funzionalità
2. Modificare il metodo `verifyLicenseKey` per supportare le nuove chiavi
3. Aggiornare l'interfaccia utente in `components/setup/SetupWizard.tsx` e `components/settings/Settings.tsx`
4. Aggiornare il generatore di licenze in `tools/license-generator-sqlite.js`

### Backup e Ripristino

Il sistema include funzionalità per il backup e il ripristino del database:

1. **Backup Automatici**:
   - I backup vengono eseguiti automaticamente a intervalli configurabili
   - I file di backup vengono salvati nella directory `server/backups/`
   - Il formato del nome file è `slabs-db-[TIMESTAMP].sqlite`

2. **Ripristino**:
   - È possibile ripristinare il database da un file di backup
   - Il ripristino sostituisce completamente il database corrente
   - È consigliabile eseguire un backup prima del ripristino

### Aggiornamento del Database

Per aggiornare lo schema del database:

1. Creare una funzione di migrazione per aggiornare i database esistenti
2. Aggiornare i modelli interessati con i nuovi campi/metodi
3. Testare la migrazione su un database di test prima di applicarla in produzione