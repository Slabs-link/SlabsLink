/**
 * Servizio per l'automazione dell'invio di messaggi WhatsApp Web
 * Questo servizio utilizza Puppeteer per interagire con WhatsApp Web
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { getDatabase } from '../config/database-sqlite';
import fs from 'fs';
import path from 'path';

interface WhatsAppSettings {
  enabled?: boolean;
  browserPath?: string;
  dataPath?: string;
  autoReply?: boolean;
  autoReplyMessage?: string;
}

class WhatsAppWebService {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isInitialized = false;
  private isAuthenticated = false;
  private sessionDataPath: string = path.resolve(process.cwd(), 'data', 'whatsapp-session');
  private authCheckInterval: NodeJS.Timeout | null = null;
  private maxAuthWaitTime = 7 * 60 * 1000; // 7 minuti in millisecondi
  private isReinitializing = false; // Flag per prevenire invii multipli durante la reinizializzazione
  private sentMessages: Map<string, number> = new Map(); // Mappa per tracciare i messaggi inviati recentemente (chiave: numero+messaggio, valore: timestamp)

  /**
   * Ottiene le impostazioni di WhatsApp dal database
   * @returns Le impostazioni di WhatsApp o un oggetto vuoto se non trovate
   */
  private getWhatsAppSettings(): WhatsAppSettings {
    try {
      const db = getDatabase();
      if (!db) {
        console.error('Database non disponibile');
        return {};
      }

      const setting = db.prepare('SELECT * FROM app_settings WHERE key = ?').get('whatsapp') as { value: string } | undefined;
      
      if (!setting) {
        console.log('Impostazioni WhatsApp non trovate nel database');
        return {};
      }

      try {
        // Converti il valore JSON in oggetto JavaScript
        return JSON.parse(setting.value);
      } catch (error) {
        console.error('Errore durante il parsing delle impostazioni WhatsApp:', error);
        return {};
      }
    } catch (error) {
      console.error('Errore durante il recupero delle impostazioni WhatsApp:', error);
      return {};
    }
  }

  /**
   * Inizializza il browser Puppeteer e apre WhatsApp Web
   */
  async initialize(): Promise<boolean> {
    try {
      if (this.isInitialized && this.browser) {
        console.log('WhatsApp Web Service già inizializzato');
        return true;
      }

      // Ottieni le impostazioni di WhatsApp dal database
      const settings = this.getWhatsAppSettings();
      
      // Usa il percorso configurato o quello predefinito
      if (settings.dataPath) {
        this.sessionDataPath = settings.dataPath;
        console.log(`Usando il percorso configurato per i dati WhatsApp: ${this.sessionDataPath}`);
      } else {
        this.sessionDataPath = path.resolve(process.cwd(), 'data', 'whatsapp-session');
        console.log(`Usando il percorso predefinito per i dati WhatsApp: ${this.sessionDataPath}`);
      }
      
      // Crea la directory se non esiste
      if (!fs.existsSync(this.sessionDataPath)) {
        console.log(`Creazione directory per i dati WhatsApp: ${this.sessionDataPath}`);
        fs.mkdirSync(this.sessionDataPath, { recursive: true });
      }

      // Configura le opzioni di lancio del browser
      const launchOptions = {
        headless: false, // Deve essere visibile per la scansione del QR code
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
        defaultViewport: null, // Permette alla finestra di adattarsi alla dimensione dello schermo
        userDataDir: this.sessionDataPath // Salva i dati della sessione per mantenere l'autenticazione
      };

      // Avvia un nuovo browser
      this.browser = await puppeteer.launch(launchOptions);

      // Apri una nuova pagina
      this.page = await this.browser.newPage();
      
      // Imposta viewport per simulare uno schermo desktop
      await this.page.setViewport({ width: 1280, height: 800 });
      
      // Naviga a WhatsApp Web
      if (this.page) {
        await this.page.goto('https://web.whatsapp.com/', { waitUntil: 'networkidle2', timeout: 100000 });
        console.log('Pagina WhatsApp Web aperta, verifica autenticazione...');
        
        // Verifica lo stato di autenticazione
        const isAuthenticated = await this.checkAuthenticationStatus(false);
        
        if (!isAuthenticated) {
          console.log('Autenticazione richiesta, scansiona il QR code per autenticarti');
          // Avvia un controllo periodico dell'autenticazione
          await this.waitForAuthentication();
        }
      }
      
      this.isInitialized = true;
      console.log('WhatsApp Web Service inizializzato con successo');
      return true;
    } catch (error) {
      console.error('Errore durante l\'inizializzazione di Puppeteer:', error);
      return false;
    }
  }

  /**
   * Verifica se il servizio è stato inizializzato
   */
  isReady(): boolean {
    return this.isInitialized && this.browser !== null && this.page !== null;
  }
  
  /**
   * Verifica se l'utente è autenticato su WhatsApp Web
   */
  isUserAuthenticated(): boolean {
    return this.isAuthenticated;
  }
  
  /**
   * Verifica lo stato di autenticazione su WhatsApp Web
   * @param navigate Se true, naviga a WhatsApp Web prima di verificare lo stato
   * @returns true se l'utente è autenticato, false altrimenti
   */
  async checkAuthenticationStatus(navigate: boolean = true): Promise<boolean> {
    if (!this.isReady() || !this.page) {
      console.error('Puppeteer non è stato inizializzato');
      return false;
    }
    
    try {
      // Verifica se la pagina è ancora valida
      try {
        // Tenta di eseguire una semplice operazione per verificare se la pagina è ancora valida
        await this.page.evaluate(() => document.title);
      } catch (error) {
        console.error('Pagina non più valida, tentativo di reinizializzazione:', error);
        
        // Imposta il flag di reinizializzazione per prevenire invii duplicati
        this.isReinitializing = true;
        
        // Chiudi il browser se esiste
        if (this.browser) {
          try {
            await this.browser.close();
          } catch (closeError) {
            console.error('Errore durante la chiusura del browser:', closeError);
          }
        }
        
        // Reimposta le variabili
        this.browser = null;
        this.page = null;
        this.isInitialized = false;
        this.isAuthenticated = false;
        
        // Reinizializza il browser
        const initialized = await this.initialize();
        
        // Reimposta il flag di reinizializzazione
        this.isReinitializing = false;
        
        if (!initialized) {
          console.error('Impossibile reinizializzare il browser');
          return false;
        }
        
        // Assicurati che la pagina sia definita dopo la reinizializzazione
        if (!this.page) {
          console.error('Pagina non definita dopo la reinizializzazione');
          return false;
        }
      }
      
      // Naviga a WhatsApp Web solo se richiesto
      if (navigate) {
        try {
          await this.page.goto('https://web.whatsapp.com/', { waitUntil: 'networkidle2', timeout: 30000 });
        } catch (error) {
          console.error('Errore durante la navigazione a WhatsApp Web:', error);
          return false;
        }
      }
      
      // Verifica se è presente il QR code (utente non autenticato)
      const qrCodeFound = await this.page.evaluate(() => {
        return !!document.querySelector('div[data-testid="qrcode"]') || 
               !!document.querySelector('canvas[aria-label="Scan me!"]');
      });
      
      if (qrCodeFound) {
        console.log('Utente non autenticato su WhatsApp Web, QR code presente');
        this.isAuthenticated = false;
        return false;
      }
      
      // Verifica se l'utente è autenticato cercando elementi chiave dell'interfaccia
      const isAuthenticated = await this.page.evaluate(() => {
        // Verifica la presenza di elementi che indicano autenticazione
        const hasFooter = !!document.querySelector('footer');
        const hasTextbox = !!document.querySelector('div[role="textbox"]');
        const hasButton = !!document.querySelector('button[aria-label="Invia"]');
        
        // Verifica anche classi specifiche di WhatsApp
        const hasWhatsAppClasses = document.querySelectorAll('[class*="_"]').length > 0;
        
        return {
          authenticated: hasFooter || hasTextbox || hasButton || hasWhatsAppClasses,
          details: { hasFooter, hasTextbox, hasButton, hasWhatsAppClasses }
        };
      });
      
      if (isAuthenticated.authenticated) {
        console.log('Utente autenticato su WhatsApp Web', isAuthenticated.details);
        this.isAuthenticated = true;
        
        // Se l'autenticazione è avvenuta con successo, processa le notifiche in attesa
        if (!navigate) { // Solo quando viene chiamato durante il controllo periodico
          await this.processAuthenticationRequiredNotifications();
          
          // Forza l'elaborazione immediata delle notifiche in attesa
          this.triggerPendingNotificationsProcessing();
        }
        
        return true;
      }
      
      // Verifica semplificata: controlla solo le classi specifiche di WhatsApp
      console.log('Esecuzione verifica finale per classi specifiche di WhatsApp...');
      const whatsappClasses = await this.page.evaluate(() => {
        // Cerca elementi con classi specifiche di WhatsApp (solo underscore e app)
        const classPatterns = ['_', 'app'];
        
        let foundAny = false;
        const counts: Record<string, number> = {};
        
        classPatterns.forEach(pattern => {
          // Cerca elementi che contengono la classe specificata
          const elements = document.querySelectorAll(`[class*="${pattern}"]`);
          if (elements.length > 0) {
            foundAny = true;
            counts[pattern] = elements.length;
          }
        });
        
        return {
          found: foundAny,
          counts: counts
        };
      });
      
      if (whatsappClasses.found) {
        console.log('Utente autenticato su WhatsApp Web (rilevamento classi)');
        console.log('Classi trovate:', JSON.stringify(whatsappClasses.counts, null, 2));
        this.isAuthenticated = true;
        
        // Se l'autenticazione è avvenuta con successo, processa le notifiche in attesa
        if (!navigate) { // Solo quando viene chiamato durante il controllo periodico
          await this.processAuthenticationRequiredNotifications();
          
          // Forza l'elaborazione immediata delle notifiche in attesa
          this.triggerPendingNotificationsProcessing();
        }
        
        return true;
      }
      
      // Se non troviamo né il QR code né altri elementi che indicano autenticazione, consideriamo l'utente non autenticato
      console.log('Stato di autenticazione non determinabile, considerato non autenticato');
      console.log('Titolo della pagina:', await this.page.title());
      this.isAuthenticated = false;
      return false;
    } catch (error) {
      console.error('Errore durante la verifica dello stato di autenticazione:', error);
      this.isAuthenticated = false;
      return false;
    }
  }

  /**
   * Pulisce i messaggi vecchi dalla mappa sentMessages
   * Rimuove i messaggi inviati più di 5 minuti fa
   */
  private cleanupSentMessages(): void {
    const now = Date.now();
    const expirationTime = 5 * 60 * 1000; // 5 minuti in millisecondi
    
    for (const [key, timestamp] of this.sentMessages.entries()) {
      if (now - timestamp > expirationTime) {
        this.sentMessages.delete(key);
      }
    }
  }
  
  /**
   * Verifica se un messaggio è stato inviato recentemente per evitare duplicati
   * @param phoneNumber Numero di telefono del destinatario
   * @param message Contenuto del messaggio
   * @returns true se il messaggio è stato inviato recentemente, false altrimenti
   */
  private isRecentlySent(phoneNumber: string, message: string): boolean {
    // Crea una chiave unica per questo messaggio
    const messageKey = `${phoneNumber}:${message}`;
    
    // Pulisci i messaggi vecchi
    this.cleanupSentMessages();
    
    // Verifica se il messaggio è stato inviato recentemente
    return this.sentMessages.has(messageKey);
  }
  
  /**
   * Registra un messaggio come inviato per evitare duplicati
   * @param phoneNumber Numero di telefono del destinatario
   * @param message Contenuto del messaggio
   */
  private markAsSent(phoneNumber: string, message: string): void {
    // Crea una chiave unica per questo messaggio
    const messageKey = `${phoneNumber}:${message}`;
    
    // Registra il messaggio con il timestamp corrente
    this.sentMessages.set(messageKey, Date.now());
  }
  
  /**
   * Reinizializza il browser e la pagina quando si verifica un errore di frame distaccato
   * @returns true se la reinizializzazione è avvenuta con successo, false altrimenti
   */
  private async reinitializeBrowser(): Promise<boolean> {
    console.log('Avvio reinizializzazione del browser dopo errore di frame distaccato...');
    
    try {
      // Imposta il flag di reinizializzazione per prevenire invii duplicati
      this.isReinitializing = true;
      
      // Chiudi il browser se esiste
      if (this.browser) {
        try {
          await this.browser.close();
        } catch (closeError) {
          console.error('Errore durante la chiusura del browser:', closeError);
        }
      }
      
      // Reimposta le variabili
      this.browser = null;
      this.page = null;
      this.isInitialized = false;
      this.isAuthenticated = false;
      
      // Reinizializza il browser
      const initialized = await this.initialize();
      if (!initialized) {
        console.error('Impossibile reinizializzare il browser');
        this.isReinitializing = false; // Reimposta il flag anche in caso di errore
        return false;
      }
      
      console.log('Browser reinizializzato con successo');
      
      // Reimposta il flag di reinizializzazione
      this.isReinitializing = false;
      return true;
    } catch (error) {
      console.error('Errore durante la reinizializzazione del browser:', error);
      this.isReinitializing = false; // Reimposta il flag anche in caso di errore
      return false;
    }
  }

  /**
   * Cattura uno screenshot della pagina corrente per debug
   * @param filename Nome del file per lo screenshot
   */
  private async captureDebugScreenshot(filename: string): Promise<void> {
    if (!this.page) return;
    
    try {
      // Crea la directory se non esiste
      const screenshotDir = path.resolve(process.cwd(), 'data', 'debug-screenshots');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      
      // Genera un nome file con timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fullPath = path.join(screenshotDir, `${filename}-${timestamp}.png`);
      
      // Cattura lo screenshot
      await this.page.screenshot({ path: fullPath, fullPage: true });
      console.log(`Screenshot di debug salvato: ${fullPath}`);
    } catch (error) {
      console.error('Errore durante la cattura dello screenshot di debug:', error);
    }
  }

  /**
   * Attende che l'utente completi l'autenticazione tramite QR code
   * @returns true se l'autenticazione è avvenuta con successo, false altrimenti
   */
  async waitForAuthentication(): Promise<boolean> {
    if (!this.isReady() || !this.page) {
      console.error('Puppeteer non è stato inizializzato');
      return false;
    }

    // Cattura uno screenshot iniziale per debug
    await this.captureDebugScreenshot('auth-start');

    return new Promise<boolean>((resolve) => {
      let elapsedTime = 0;
      const checkInterval = 3000; // Controlla ogni 3 secondi (più frequente)
      let checkCount = 0;
      
      // Pulisci eventuali intervalli precedenti
      if (this.authCheckInterval) {
        clearInterval(this.authCheckInterval);
        this.authCheckInterval = null;
      }
      
      // Imposta un nuovo intervallo per controllare l'autenticazione
      this.authCheckInterval = setInterval(async () => {
        try {
          checkCount++;
          console.log(`Controllo autenticazione #${checkCount}...`);
          
          // Cattura uno screenshot periodico per debug (ogni 5 controlli)
          if (checkCount % 5 === 0) {
            await this.captureDebugScreenshot(`auth-check-${checkCount}`);
          }
          
          // Verifica se la pagina è ancora valida prima di procedere
          let pageValid = true;
          try {
            // Tenta di eseguire una semplice operazione per verificare se la pagina è ancora valida
            await this.page?.evaluate(() => document.title);
          } catch (pageError) {
            console.error('Pagina non più valida durante il controllo di autenticazione:', pageError);
            pageValid = false;
            
            // Imposta il flag di reinizializzazione per prevenire invii duplicati
            this.isReinitializing = true;
            
            // Tenta di reinizializzare il browser
            try {
              // Chiudi il browser se esiste
              if (this.browser) {
                try {
                  await this.browser.close();
                } catch (closeError) {
                  console.error('Errore durante la chiusura del browser:', closeError);
                }
              }
              
              // Reimposta le variabili
              this.browser = null;
              this.page = null;
              this.isInitialized = false;
              this.isAuthenticated = false;
              
              // Reinizializza il browser
              const initialized = await this.initialize();
              
              // Reimposta il flag di reinizializzazione
              this.isReinitializing = false;
              
              if (!initialized) {
                console.error('Impossibile reinizializzare il browser');
                if (this.authCheckInterval) {
                  clearInterval(this.authCheckInterval);
                  this.authCheckInterval = null;
                }
                resolve(false);
                return;
              }
              
              // Continua con il controllo dell'autenticazione
              pageValid = true;
            } catch (reinitError) {
              console.error('Errore durante la reinizializzazione del browser:', reinitError);
              // Reimposta il flag di reinizializzazione anche in caso di errore
              this.isReinitializing = false;
              if (this.authCheckInterval) {
                clearInterval(this.authCheckInterval);
                this.authCheckInterval = null;
              }
              resolve(false);
              return;
            }
          }
          
          if (!pageValid) {
            return; // Salta questo ciclo se la pagina non è valida
          }
          
          // Verifica lo stato di autenticazione senza navigare nuovamente
          const isAuthenticated = await this.checkAuthenticationStatus(false);
          elapsedTime += checkInterval;
          
          if (isAuthenticated) {
            // Autenticazione completata con successo
            console.log('Autenticazione completata con successo');
            // Cattura uno screenshot finale per debug
            await this.captureDebugScreenshot('auth-success');
            
            if (this.authCheckInterval) {
              clearInterval(this.authCheckInterval);
              this.authCheckInterval = null;
            }
            
            // Aggiorna lo stato delle notifiche in attesa di autenticazione
            await this.processAuthenticationRequiredNotifications();
            
            // Forza l'elaborazione immediata delle notifiche in attesa
            this.triggerPendingNotificationsProcessing();
            
            resolve(true);
          } else if (elapsedTime >= this.maxAuthWaitTime) {
            // Timeout di autenticazione
            console.log(`Timeout di autenticazione dopo ${this.maxAuthWaitTime / 1000} secondi`);
            // Cattura uno screenshot finale per debug
            await this.captureDebugScreenshot('auth-timeout');
            
            if (this.authCheckInterval) {
              clearInterval(this.authCheckInterval);
              this.authCheckInterval = null;
            }
            resolve(false);
          } else {
            // Aggiorna il messaggio di log con il tempo trascorso
            console.log(`In attesa dell'autenticazione... (${Math.floor(elapsedTime / 1000)}s)`);
            
            // Verifica se il QR code è ancora presente usando i selettori migliorati
            try {
              const qrCodeSelectors = [
                'div[data-testid="qrcode"]',
                'canvas[aria-label="Scan me!"]',
                'div[data-ref]',
                'div.landing-wrapper'
              ];
              
              let qrCodeFound = false;
              for (const selector of qrCodeSelectors) {
                const qrCode = await this.page?.$eval(selector, el => !!el).catch(() => false);
                if (qrCode) {
                  qrCodeFound = true;
                  break;
                }
              }
              
              if (!qrCodeFound) {
                console.log('QR code non più visibile, verifica autenticazione...');
                // Cattura uno screenshot quando il QR code scompare
                await this.captureDebugScreenshot('qr-disappeared');
                
                // Forza un controllo aggiuntivo dell'autenticazione
                const recheckAuth = await this.checkAuthenticationStatus(false);
                if (recheckAuth) {
                  console.log('Autenticazione rilevata dopo la scomparsa del QR code');
                  if (this.authCheckInterval) {
                    clearInterval(this.authCheckInterval);
                    this.authCheckInterval = null;
                  }
                  
                  // Aggiorna lo stato delle notifiche in attesa di autenticazione
                  await this.processAuthenticationRequiredNotifications();
                  
                  // Forza l'elaborazione immediata delle notifiche in attesa
                  this.triggerPendingNotificationsProcessing();
                  
                  resolve(true);
                }
              }
            } catch (qrError) {
              console.error('Errore durante la verifica del QR code:', qrError);
              // Continua con il ciclo successivo
            }
          }
        } catch (error) {
          console.error('Errore durante il controllo dell\'autenticazione:', error);
          // Non interrompiamo il ciclo per errori generici, a meno che non sia un problema di pagina distaccata
          if (error instanceof Error && error.message.includes('detached Frame')) {
            console.log('Rilevato errore di frame distaccato, tentativo di reinizializzazione...');
            // Tenta di reinizializzare nella prossima iterazione
          } else if (this.authCheckInterval) {
            clearInterval(this.authCheckInterval);
            this.authCheckInterval = null;
            resolve(false);
          }
        }
      }, checkInterval);
    });
  }

  /**
   * Processa le notifiche che sono in attesa di autenticazione
   * Questo metodo viene chiamato dopo che l'autenticazione è stata completata con successo
   */
  private async processAuthenticationRequiredNotifications(): Promise<void> {
    try {
      const db = getDatabase();
      if (!db) {
        console.error('Database non disponibile');
        return;
      }

      // Recupera tutte le notifiche in stato 'authentication_required'
      const authRequiredNotifications = db.prepare(`
        SELECT n.*, u.phone, u.first_name, u.last_name
        FROM notifications n
        JOIN users u ON n.user_id = u.id
        WHERE n.status = 'authentication_required'
        ORDER BY n.created_at ASC
      `).all();
      
      console.log(`Trovate ${authRequiredNotifications.length} notifiche in attesa di autenticazione da elaborare`);
      
      // Se non ci sono notifiche da elaborare, termina
      if (authRequiredNotifications.length === 0) {
        return;
      }
      
      // Aggiorna lo stato delle notifiche a 'pending' per permettere la loro elaborazione
      db.prepare(`
        UPDATE notifications SET
          status = 'pending',
          error_message = NULL,
          updated_at = datetime('now')
        WHERE status = 'authentication_required'
      `).run();
      
      console.log(`Stato di ${authRequiredNotifications.length} notifiche aggiornato da 'authentication_required' a 'pending'`);
    } catch (error) {
      console.error('Errore durante l\'elaborazione delle notifiche in attesa di autenticazione:', error);
    }
  }
  
  /**
   * Forza l'elaborazione immediata delle notifiche in attesa
   * Questo metodo viene chiamato dopo che l'autenticazione è stata completata con successo
   */
  private triggerPendingNotificationsProcessing(): void {
    try {
      console.log('Avvio elaborazione immediata delle notifiche in attesa dopo autenticazione');
      
      // Ottieni il database
      const db = getDatabase();
      if (!db) {
        throw new Error('Database non disponibile');
      }
      
      // Verifica se ci sono notifiche in attesa
      const result = db.prepare(`
        SELECT COUNT(*) as count FROM notifications WHERE status = 'pending'
      `).get();
      const pendingCount = (result as { count: number }).count;
      
      console.log(`Trovate ${pendingCount} notifiche in attesa da elaborare immediatamente`);
      
      // Se non ci sono notifiche in attesa, termina
      if (pendingCount === 0) {
        console.log('Nessuna notifica in attesa da elaborare immediatamente');
        return;
      }
      
      // Utilizza la funzione globale per elaborare le notifiche
      if ((global as any).processWhatsAppNotifications) {
        // Importa il servizio WhatsApp
        const WhatsAppService = require('./whatsapp.service').default;
        
        // Utilizza la funzione globale per elaborare le notifiche
        setTimeout(async () => {
          console.log('Avvio elaborazione notifiche in attesa tramite funzione globale');
          try {
            await (global as any).processWhatsAppNotifications(
              db, 
              this, // passa l'istanza corrente del servizio WhatsApp Web
              WhatsAppService, 
              true // usa WhatsApp Web
            );
          } catch (error) {
            console.error('Errore durante l\'elaborazione immediata delle notifiche:', error);
          }
        }, 1000); // Attendi 1 secondo per assicurarsi che il database sia aggiornato
      } else {
        console.error('Funzione processWhatsAppNotifications non disponibile globalmente');
      }
    } catch (error) {
      console.error('Errore durante il trigger dell\'elaborazione delle notifiche in attesa:', error);
    }
  }

  /**
   * Invia un messaggio WhatsApp utilizzando WhatsApp Web
   * @param phoneNumber Numero di telefono del destinatario
   * @param message Messaggio da inviare
   * @param autoSend Se true, tenta di inviare automaticamente il messaggio
   * @returns true se l'operazione è riuscita, false altrimenti
   */
  async sendMessage(phoneNumber: string, message: string, autoSend: boolean = false): Promise<boolean> {
    try {
      // Verifica se è in corso una reinizializzazione
      if (this.isReinitializing) {
        console.log('Reinizializzazione del browser in corso, invio del messaggio bloccato per prevenire duplicati');
        this.updateNotificationStatus('failed', 'Operazione bloccata: reinizializzazione del browser in corso');
        return false;
      }
      
      // Verifica se il messaggio contiene placeholder non sostituiti
      const placeholderRegex = /\{(first_name|last_name|appointment_date|appointment_time)\}/g;
      const matches = message.match(placeholderRegex);
      if (matches && matches.length > 0) {
        console.log(`Messaggio contiene placeholder non sostituiti: ${message}`);
        console.log(`Placeholder non sostituiti trovati: ${matches.join(', ')}`);
        console.log('Invio bloccato per prevenire l\'invio di messaggi con placeholder non sostituiti');
        this.updateNotificationStatus('failed', `Messaggio contiene placeholder non sostituiti: ${matches.join(', ')}`);
        return false;
      }
      
      // Verifica se il messaggio è stato inviato recentemente
      if (this.isRecentlySent(phoneNumber, message)) {
        console.log(`Messaggio già inviato a ${phoneNumber} recentemente, invio bloccato per prevenire duplicati`);
        this.updateNotificationStatus('sent', 'Messaggio già inviato recentemente');
        return true; // Restituiamo true per non far ripetere l'invio
      }

      // Inizializza il servizio se non è già inizializzato
      if (!this.isReady()) {
        console.log('Servizio WhatsApp Web non inizializzato, avvio inizializzazione...');
        const initialized = await this.initialize();
        if (!initialized) {
          console.error('Impossibile inizializzare il servizio WhatsApp Web');
          this.updateNotificationStatus('failed', 'Impossibile inizializzare il servizio WhatsApp Web');
          return false;
        }
      }

      // Verifica se la pagina è ancora valida
      try {
        if (this.page) {
          await this.page.evaluate(() => document.title);
        } else {
          throw new Error('Pagina non disponibile');
        }
      } catch (pageError) {
        console.error('Pagina non più valida, tentativo di reinizializzazione:', pageError);
        
        // Imposta il flag di reinizializzazione
        this.isReinitializing = true;
        
        // Chiudi il browser se esiste
        if (this.browser) {
          try {
            await this.browser.close();
          } catch (closeError) {
            console.error('Errore durante la chiusura del browser:', closeError);
          }
        }
        
        // Reimposta le variabili
        this.browser = null;
        this.page = null;
        this.isInitialized = false;
        this.isAuthenticated = false;
        
        // Reinizializza il browser
        const reinitialized = await this.initialize();
        
        // Reimposta il flag di reinizializzazione
        this.isReinitializing = false;
        
        if (!reinitialized) {
          console.error('Impossibile reinizializzare il browser');
          this.updateNotificationStatus('failed', 'Impossibile reinizializzare il browser WhatsApp');
          return false;
        }
      }

      // Verifica lo stato di autenticazione
      const isAuthenticated = await this.checkAuthenticationStatus();
      if (!isAuthenticated) {
        console.log('Utente non autenticato su WhatsApp Web, attendo autenticazione...');
        // Aggiorna lo stato della notifica nel database
        this.updateNotificationStatus('authentication_required', 'Autenticazione WhatsApp Web richiesta');
        
        // Attendi che l'utente completi l'autenticazione
        const authSuccess = await this.waitForAuthentication();
        if (!authSuccess) {
          console.log('Timeout di autenticazione, impossibile inviare il messaggio');
          this.updateNotificationStatus('failed', 'Timeout di autenticazione WhatsApp Web');
          return false;
        }
        
        // Se l'autenticazione è avvenuta con successo, verifica nuovamente lo stato
        const recheck = await this.checkAuthenticationStatus(false);
        if (!recheck) {
          console.log('Verifica dell\'autenticazione fallita dopo il completamento');
          this.updateNotificationStatus('failed', 'Verifica autenticazione WhatsApp Web fallita');
          return false;
        }
        
        console.log('Autenticazione verificata, procedo con l\'invio del messaggio');
      }

      // Formatta il numero di telefono
      let formattedNumber = phoneNumber.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
      
      // Aggiungi il prefisso italiano +39 se non è già presente
      if (!formattedNumber.startsWith('+')) {
        formattedNumber = '+39' + formattedNumber;
      }

      // Crea l'URL per WhatsApp Web con il messaggio precompilato
      const whatsappUrl = `https://web.whatsapp.com/send?phone=${formattedNumber}&text=${encodeURIComponent(message)}`;
      
      if (!this.page) {
        console.error('Pagina Puppeteer non disponibile');
        return false;
      }

      // Naviga all'URL di WhatsApp Web
      try {
        await this.page.goto(whatsappUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      } catch (error) {
        console.error('Errore durante la navigazione a WhatsApp Web:', error);
        
        // Se l'errore è relativo a un frame distaccato o contesto di esecuzione distrutto
        if (error instanceof Error && 
            (error.message.includes('detached Frame') || 
             error.message.includes('Execution context was destroyed'))) {
          console.log('Rilevato errore di frame distaccato o contesto distrutto, tentativo di reinizializzazione...');
          
          // Imposta il flag di reinizializzazione per prevenire invii duplicati
          this.isReinitializing = true;
          
          // Aggiorna lo stato della notifica per indicare che c'è un problema
          this.updateNotificationStatus('failed', `Errore di navigazione: ${error.message}`);
          
          // Chiudi il browser se esiste
          if (this.browser) {
            try {
              await this.browser.close();
            } catch (closeError) {
              console.error('Errore durante la chiusura del browser:', closeError);
            }
          }
          
          // Reimposta le variabili
          this.browser = null;
          this.page = null;
          this.isInitialized = false;
          this.isAuthenticated = false;
          
          // Reinizializza il browser
          const reinitialized = await this.initialize();
          
          // Reimposta il flag di reinizializzazione
          this.isReinitializing = false;
          
          if (!reinitialized) {
            console.error('Impossibile reinizializzare il browser dopo errore di frame distaccato');
            this.updateNotificationStatus('failed', 'Impossibile reinizializzare WhatsApp Web dopo errore');
            return false;
          }
          
          // Non riproviamo immediatamente a navigare, ma restituiamo false per evitare invii duplicati
          console.log('Browser reinizializzato con successo, ma l\'invio è stato interrotto per evitare duplicati');
          return false;
        } else {
          // Per altri tipi di errori
          this.updateNotificationStatus('failed', `Errore di navigazione: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
          return false;
        }
      }
      
      // Verifica se appare il messaggio di errore per numero non valido
      const invalidNumberError = await this.page.$('div[data-testid="alert-phone-number"]')
        .catch(() => null);
      
      if (invalidNumberError) {
        console.error('Numero di telefono non valido o non registrato su WhatsApp');
        this.updateNotificationStatus('failed', 'Numero di telefono non valido o non registrato su WhatsApp');
        return false;
      }
      
      // Attendi che la pagina sia caricata completamente
      try {
        console.log('Attesa caricamento pannello conversazione...');
        
        // Attendi che il footer sia visibile (indicatore che la pagina è caricata)
        try {
          await this.page.waitForSelector('footer', { timeout: 15000 });
          console.log('Footer trovato, pagina caricata');
        } catch (footerError) {
          console.log('Footer non trovato, continuo comunque');
        }
        
        // Attendi un momento extra per assicurarsi che la pagina sia completamente caricata
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Verifica se la pagina contiene elementi tipici di WhatsApp Web
        const pageContent = await this.page.evaluate(() => {
          return {
            hasTextbox: !!document.querySelector('div[role="textbox"]'),
            hasFooter: !!document.querySelector('footer'),
            title: document.title
          };
        });
        
        console.log('Stato elementi pagina:', JSON.stringify(pageContent));
      } catch (error) {
        // Cattura uno screenshot per debug
        await this.captureDebugScreenshot('conversation-panel-error');
        
        // Verifica se è apparso il QR code (sessione scaduta)
        const qrCode = await this.page.$('div[data-testid="qrcode"]');
        
        if (qrCode) {
          console.log('Sessione scaduta, è necessario scansionare nuovamente il QR code');
          this.isAuthenticated = false;
          this.updateNotificationStatus('authentication_required', 'Sessione WhatsApp Web scaduta, autenticazione richiesta');
          
          // Attendi che l'utente completi l'autenticazione
          const authSuccess = await this.waitForAuthentication();
          if (!authSuccess) {
            console.log('Timeout di autenticazione, impossibile inviare il messaggio');
            return false;
          }
        } else {
          console.log(`Attesa per il pannello di conversazione scaduta: ${error instanceof Error ? error.message : 'motivo sconosciuto'}`);
          
          // Tenta un approccio alternativo: verifica se la pagina è comunque caricata correttamente
          const pageTitle = await this.page.title();
          console.log(`Titolo della pagina: ${pageTitle}`);
          
          if (pageTitle.includes('WhatsApp')) {
            console.log('La pagina sembra essere WhatsApp, tentativo di procedere comunque...');
            // Continua con l'esecuzione anche se non abbiamo trovato il pannello di conversazione
          } else {
            this.updateNotificationStatus('failed', 'Impossibile caricare la conversazione WhatsApp');
            return false;
          }
        }
      }
      
      // Verifica nuovamente se siamo autenticati
      if (!this.isAuthenticated) {
        return false;
      }

      // Se autoSend è true, tenta di inviare automaticamente il messaggio
      if (autoSend) {
        // Attendi un momento per assicurarsi che la pagina sia completamente caricata
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 secondi sono sufficienti
        
        console.log('Tentativo di invio automatico del messaggio...');
        
        // Cattura uno screenshot per debug prima del tentativo di invio
        await this.captureDebugScreenshot('pre-send-attempt');
        
        // Verifica se il messaggio è già stato inserito nella casella di testo
        let messageContent = null;
        try {
          messageContent = await this.page.evaluate(() => {
            const inputElement = document.querySelector('div[role="textbox"]');
            return inputElement ? inputElement.textContent : null;
          });
          
          console.log(`Contenuto rilevato nella casella di testo (div[role="textbox"]): ${messageContent || 'vuoto'}`);
        } catch (error) {
          console.log(`Errore durante la verifica del contenuto della casella di testo:`, error);
        }
        
        // Cerca solo il pulsante di invio con il selettore specifico richiesto
        const sendButtonSelector = 'button[aria-label="Invia"]';
        
        // Verifica se il pulsante di invio è visibile e attivo
        let sendButtonInfo = { found: false, isVisible: false, isEnabled: false };
        
        try {
          const buttonInfo = await this.page.evaluate((sel) => {
            const sendButton = document.querySelector(sel);
            if (!sendButton) return { found: false, isVisible: false, isEnabled: false };
            
            // Verifica se il pulsante è visibile
            const rect = sendButton.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0;
            
            // Verifica se il pulsante non è disabilitato
            const isEnabled = !sendButton.hasAttribute('disabled') && 
                            !sendButton.classList.contains('disabled') &&
                            window.getComputedStyle(sendButton).opacity !== '0';
            
            return { 
              found: true, 
              isVisible, 
              isEnabled,
              tagName: sendButton.tagName,
              className: sendButton.className,
              id: sendButton.id || 'nessuno',
              ariaLabel: sendButton.getAttribute('aria-label') || 'nessuno'
            };
          }, sendButtonSelector);
          
          if (buttonInfo.found) {
            console.log(`Pulsante di invio trovato con selettore ${sendButtonSelector}:`, buttonInfo);
            sendButtonInfo = buttonInfo;
          }
        } catch (error) {
          console.log(`Errore durante la verifica del pulsante con selettore ${sendButtonSelector}:`, error);
        }
        
        console.log(`Pulsante di invio trovato: ${sendButtonInfo.found ? 'Sì' : 'No'}, Visibile: ${sendButtonInfo.isVisible ? 'Sì' : 'No'}, Attivo: ${sendButtonInfo.isEnabled ? 'Sì' : 'No'}`);
        
        // Utilizziamo un solo metodo di invio per evitare invii multipli
        if (sendButtonInfo.found && sendButtonInfo.isVisible && sendButtonInfo.isEnabled) {
          console.log('Tentativo di invio tramite script di click...');
          try {
            // Usa solo il selettore specifico per il pulsante di invio
            const clickResult = await this.page.evaluate((selector) => {
              const button = document.querySelector(selector);
              if (!button) return false;
              
              try {
                // Simula un click tramite JavaScript
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                button.dispatchEvent(clickEvent);
                return true;
              } catch (e) {
                console.log(`Errore durante il click: ${e}`);
                return false;
              }
            }, sendButtonSelector);
            
            if (clickResult) {
              console.log('Messaggio inviato tramite script di click');
              await new Promise(resolve => setTimeout(resolve, 3000)); // Attendi più tempo per confermare l'invio
              
              // Registra il messaggio come inviato
              this.markAsSent(phoneNumber, message);
              
              this.updateNotificationStatus('sent', 'Messaggio inviato con successo');
              return true;
            } else {
              // Se il click non è riuscito, registra l'errore
              console.log('Click sul pulsante di invio non riuscito');
              await this.captureDebugScreenshot('click-failed');
              this.updateNotificationStatus('failed', 'Invio automatico fallito: click non riuscito');
              return false;
            }
          } catch (scriptError) {
            console.error('Errore durante l\'esecuzione dello script di click:', scriptError);
            await this.captureDebugScreenshot('script-error');
            this.updateNotificationStatus('failed', 'Errore durante l\'invio del messaggio');
            return false;
          }
        } else {
          // Se il pulsante non è disponibile
          console.log('Pulsante di invio non disponibile');
          await this.captureDebugScreenshot('send-button-not-available');
          this.updateNotificationStatus('failed', 'Invio automatico fallito: pulsante di invio non disponibile');
          return false;
        }
      }

      // Se autoSend è false, considera l'operazione riuscita se siamo arrivati alla pagina di chat
      console.log('Navigazione alla chat WhatsApp completata con successo');
      return true;
    } catch (error) {
      console.error('Errore durante l\'invio del messaggio WhatsApp:', error);
      this.updateNotificationStatus('failed', `Errore durante l'invio: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
      return false;
    }
  }

  /**
   * Aggiorna lo stato di una notifica in attesa nel database
   * @param status Nuovo stato della notifica ('pending', 'sent', 'failed', 'authentication_required', ecc.)
   * @param errorMessage Messaggio di errore opzionale
   */
  private updateNotificationStatus(status: string, errorMessage?: string): void {
    try {
      const db = getDatabase();
      if (!db) {
        console.error('Database non disponibile');
        return;
      }

      // Aggiorna lo stato dell'ultima notifica in attesa
      const updateQuery = errorMessage
        ? `
          UPDATE notifications SET
            status = ?,
            error_message = ?,
            updated_at = datetime('now')
          WHERE status = 'pending'
          ORDER BY created_at ASC
          LIMIT 1
        `
        : `
          UPDATE notifications SET
            status = ?,
            updated_at = datetime('now')
          WHERE status = 'pending'
          ORDER BY created_at ASC
          LIMIT 1
        `;

      const updateStmt = db.prepare(updateQuery);
      
      // Esegui l'aggiornamento con i parametri appropriati
      const result = errorMessage
        ? updateStmt.run(status, errorMessage)
        : updateStmt.run(status);
      
      if (result.changes > 0) {
        console.log(`Notifica aggiornata con stato: ${status}${errorMessage ? `, errore: ${errorMessage}` : ''}`);
      } else {
        console.log('Nessuna notifica in attesa da aggiornare');
      }
    } catch (error) {
      console.error('Errore durante l\'aggiornamento dello stato della notifica:', error);
    }
  }

  /**
   * Chiude il browser Puppeteer
   */
  async close(): Promise<void> {
    // Pulisci eventuali intervalli di controllo dell'autenticazione
    if (this.authCheckInterval) {
      clearInterval(this.authCheckInterval);
      this.authCheckInterval = null;
    }
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isInitialized = false;
      this.isAuthenticated = false;
      console.log('WhatsApp Web Service chiuso');
    }
  }
}

// Esporta un'istanza singleton del servizio
export default new WhatsAppWebService();