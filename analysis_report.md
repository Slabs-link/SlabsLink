# Report Analisi Dipendenze Inutilizzate

Questo report elenca le dipendenze e le dipendenze di sviluppo che sembrano non essere utilizzate nel progetto, secondo l'analisi effettuata con `depcheck`.

**Nota:** `depcheck` potrebbe non rilevare tutti gli utilizzi (ad esempio, dipendenze usate solo in script non standard o caricate dinamicamente). Si consiglia un'ulteriore verifica manuale prima di rimuovere qualsiasi dipendenza.

## Dipendenze Inutilizzate

Le seguenti dipendenze di produzione sembrano non essere utilizzate:

* @types/better-sqlite3
* cors
* google-auth-library
* googleapis
* multer
* puppeteer
* recharts
* selenium-webdriver
* uuid

## Dipendenze di Sviluppo Inutilizzate

Le seguenti dipendenze di sviluppo sembrano non essere utilizzate:

* @ant-design/icons
* @types/antd
* @types/cors
* @types/electron
* @types/electron-store
* @types/multer
* @types/node-cron
* @types/selenium-webdriver
* @types/uuid
* @typescript-eslint/eslint-plugin
* @typescript-eslint/parser
* antd
* depcheck
* electron
* electron-store
* eslint
* eslint-plugin-react-hooks
* eslint-plugin-react-refresh
* nodemon
* ts-node

## Esportazioni Non Utilizzate (Analisi con `ts-prune`)

Le seguenti esportazioni sembrano non essere utilizzate all'interno del progetto (potrebbero essere utilizzate solo all'interno del loro modulo):

* `\src\models\license.model.ts:3` - `License` (used in module)
* `\src\services\notification.service.ts:8` - `NotificationService` (used in module)
* `\src\components\appointments\AppointmentNotificationHandler.tsx:39` - `default`
* `\src\components\layout\Sidebar.tsx:48` - `default`
* `\src\components\settings\GoogleCalendarTestSettings.tsx:13` - `GoogleCalendarTestSettings`
* `\src\components\templates\NotificationTemplateEditor.tsx:472` - `default`
* `\src\server\services\api.ts:34` - `default`

**Nota:** `ts-prune` identifica le esportazioni che non sono importate da *altri* moduli. Un'esportazione contrassegnata come `(used in module)` potrebbe essere utilizzata internamente nello stesso file. Verificare manualmente prima di rimuovere il codice.

## Analisi Aggiuntiva (Consigliata)

Per un'analisi più completa che includa file, funzioni ed esportazioni non utilizzate all'interno del codice sorgente, si potrebbero considerare strumenti come `ts-prune` o configurazioni specifiche di ESLint/TSLint.