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
      
      // Funzione di debug per stampare informazioni sugli elementi trovati
      const debugElementInfo = async (selector: string, description: string) => {
        try {
          const element = await this.page?.$eval(selector, (el) => ({
            exists: true,
            tagName: el.tagName,
            className: el.className,
            id: el.id,
            textContent: el.textContent?.substring(0, 50) || ''
          })).catch(() => ({ exists: false }));
          
          // Type guard per verificare la struttura completa dell'oggetto
          const hasFullStructure = (obj: any): obj is { exists: boolean; tagName: string; className: string; id: string; textContent: string } => {
            if (!obj || typeof obj !== 'object') return false;
            const requiredProps = ['exists', 'tagName', 'className', 'id', 'textContent'];
            return requiredProps.every(prop => prop in obj);
          };
          
          if (!hasFullStructure(element)) {
            console.log(`DEBUG [${description}]: Elemento non ha struttura completa`);
            return false;
          }
          
          console.log(`DEBUG [${description}]: ${element.exists ? 'TROVATO' : 'NON TROVATO'}`, 
            element.exists ? `(${element.tagName}, classe: ${element.className})` : '');
          
          return element?.exists || false;
        } catch (error) {
          console.log(`DEBUG [${description}]: Errore durante la ricerca`, error);
          return false;
        }
      };
      
      // Verifica se è presente il QR code (utente non autenticato)
      const qrCodeSelectors = [
        'div[data-testid="qrcode"]',
        'canvas[aria-label="Scan me!"]',
        'div[data-ref]',  // Alcuni QR code hanno questo attributo
        'div.landing-wrapper'
      ];
      
      let qrCodeFound = false;
      for (const selector of qrCodeSelectors) {
        const found = await debugElementInfo(selector, `QR Code (${selector})`);
        if (found) {
          qrCodeFound = true;
          break;
        }
      }
      
      if (qrCodeFound) {
        console.log('Utente non autenticato su WhatsApp Web, QR code presente');
        this.isAuthenticated = false;
        return false;
      }
      
      // Selettori per elementi che indicano autenticazione
      const authSelectors = [
        // Selettori principali
        { selector: 'div[data-testid="chat-list"]', description: 'Lista chat' },
        { selector: 'div[data-testid="conversation-panel-wrapper"]', description: 'Pannello conversazione' },
        { selector: 'div[data-testid="chat-new"]', description: 'Pulsante nuova chat' },
        { selector: 'div[data-testid="drawer-left"]', description: 'Pannello laterale' },
        { selector: 'div[data-testid="conversation-compose-box"]', description: 'Box composizione messaggio' },
        
        // Selettori aggiuntivi per migliorare il rilevamento
        { selector: 'div[data-testid="default-user"]', description: 'Utente predefinito' },
        { selector: 'div[data-testid="menu-bar-menu"]', description: 'Menu principale' },
        { selector: 'div[data-testid="status-v3-unread"]', description: 'Stato non letto' },
        { selector: 'div[data-testid="cell-frame-container"]', description: 'Contenitore cella' },
        { selector: 'div[data-testid="search-input"]', description: 'Input di ricerca' },
        { selector: 'span[data-testid="menu"]', description: 'Menu' },
        { selector: 'span[data-testid="intro-text"]', description: 'Testo introduttivo' },
        { selector: 'div[data-testid="status-v3"]', description: 'Stato v3' }
      ];
      
      // Verifica la presenza di elementi che indicano autenticazione
      let authElementFound = false;
      const foundElements = [];
      
      for (const { selector, description } of authSelectors) {
        const found = await debugElementInfo(selector, description);
        if (found) {
          authElementFound = true;
          foundElements.push(description);
        }
      }
      
      if (authElementFound) {
        console.log(`Utente autenticato su WhatsApp Web. Elementi trovati: ${foundElements.join(', ')}`);
        this.isAuthenticated = true;
        
        // Se l'autenticazione è avvenuta con successo, processa le notifiche in attesa
        if (!navigate) { // Solo quando viene chiamato durante il controllo periodico
          await this.processAuthenticationRequiredNotifications();
          
          // Forza l'elaborazione immediata delle notifiche in attesa
          this.triggerPendingNotificationsProcessing();
        }
        
        return true;
      }
      
      // Verifica aggiuntiva: controlla se ci sono elementi con ruoli specifici di WhatsApp Web
      console.log('Esecuzione verifica alternativa per elementi dell\'interfaccia WhatsApp...');
      const whatsappElements = await this.page.evaluate(() => {
        // Cerca elementi tipici dell'interfaccia di WhatsApp Web
        const selectors = [
          'div[role="application"]', // Applicazione principale
          'div[role="navigation"]',  // Pannello di navigazione
          'div[role="complementary"]', // Pannello laterale
          'div[role="main"]',        // Contenuto principale
          'div[role="button"]',      // Pulsanti
          'div[role="textbox"]',     // Area di testo
          'div[role="row"]',         // Righe (chat)
          'div[role="gridcell"]'     // Celle (messaggi)
        ];
        
        // Raccoglie informazioni su tutti i selettori trovati
        const foundInfo: Record<string, number> = {};
        selectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            foundInfo[selector] = elements.length;
          }
        });
        
        return {
          found: Object.keys(foundInfo).length > 0,
          details: foundInfo
        };
      });
      
      if (whatsappElements.found) {
        console.log('Utente autenticato su WhatsApp Web (rilevamento alternativo)');
        console.log('Elementi trovati:', JSON.stringify(whatsappElements.details, null, 2));
        this.isAuthenticated = true;
        
        // Se l'autenticazione è avvenuta con successo, processa le notifiche in attesa
        if (!navigate) { // Solo quando viene chiamato durante il controllo periodico
          await this.processAuthenticationRequiredNotifications();
          
          // Forza l'elaborazione immediata delle notifiche in attesa
          this.triggerPendingNotificationsProcessing();
        }
        
        return true;
      }
      
      // Verifica finale: controlla classi specifiche di WhatsApp
      console.log('Esecuzione verifica finale per classi specifiche di WhatsApp...');
      const whatsappClasses = await this.page.evaluate(() => {
        // Cerca elementi con classi specifiche di WhatsApp
        const classPatterns = [
          '_', // WhatsApp usa spesso classi che iniziano con underscore
          'app', 
          'two', 
          'chat',
          'message',
          'pane'
        ];
        
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
      
      // Verifica finale: analisi dell'HTML della pagina per trovare pattern tipici di WhatsApp Web
      console.log('Esecuzione analisi HTML della pagina per rilevare pattern di WhatsApp Web...');
      const htmlAnalysis = await this.page.evaluate(() => {
        const html = document.documentElement.innerHTML;
        
        // Pattern tipici di WhatsApp Web quando l'utente è autenticato
        const authPatterns = [
          'WhatsApp Web', 
          'WhatsApp works with', 
          'Keep your phone connected',
          'To reduce data usage',
          'End-to-end encrypted'
        ];
        
        // Pattern tipici della pagina di login/QR code
        const loginPatterns = [
          'To use WhatsApp on your computer',
          'Use WhatsApp on Web',
          'Scan the QR code',
          'Keep me signed in'
        ];
        
        const foundAuthPatterns = authPatterns.filter(pattern => html.includes(pattern));
        const foundLoginPatterns = loginPatterns.filter(pattern => html.includes(pattern));
        
        return {
          authPatternsFound: foundAuthPatterns.length > 0,
          loginPatternsFound: foundLoginPatterns.length > 0,
          authPatterns: foundAuthPatterns,
          loginPatterns: foundLoginPatterns,
          title: document.title
        };
      });
      
      console.log('Analisi HTML completata:', JSON.stringify(htmlAnalysis, null, 2));
      
      // Se troviamo pattern di autenticazione e non di login, consideriamo l'utente autenticato
      if (htmlAnalysis.authPatternsFound && !htmlAnalysis.loginPatternsFound) {
        console.log('Utente autenticato su WhatsApp Web (rilevamento pattern HTML)');
        console.log('Pattern trovati:', htmlAnalysis.authPatterns.join(', '));
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
      console.log('Titolo della pagina:', htmlAnalysis.title);
      this.isAuthenticated = false;
      return false;
    } catch (error) {
      console.error('Errore durante la verifica dello stato di autenticazione:', error);
      this.isAuthenticated = false;
      return false;
    }
  }

  /**
   * Reinizializza il browser e la pagina quando si verifica un errore di frame distaccato
   * @returns true se la reinizializzazione è avvenuta con successo, false altrimenti
   */
  private async reinitializeBrowser(): Promise<boolean> {
    console.log('Avvio reinizializzazione del browser dopo errore di frame distaccato...');
    
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
      if (!initialized) {
        console.error('Impossibile reinizializzare il browser');
        return false;
      }
      
      console.log('Browser reinizializzato con successo');
      return true;
    } catch (error) {
      console.error('Errore durante la reinizializzazione del browser:', error);
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
        
        // Se l'errore è relativo a un frame distaccato, tenta di reinizializzare
        if (error instanceof Error && error.message.includes('detached Frame')) {
          console.log('Rilevato errore di frame distaccato, tentativo di reinizializzazione...');
          
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
          if (!reinitialized) {
            console.error('Impossibile reinizializzare il browser dopo errore di frame distaccato');
            this.updateNotificationStatus('failed', 'Impossibile reinizializzare WhatsApp Web dopo errore');
            return false;
          }
          
          // Riprova a navigare all'URL di WhatsApp Web
          if (this.page) {
            try {
              await (this.page as Page).goto(whatsappUrl, { waitUntil: 'networkidle2', timeout: 60000 });
            } catch (retryError) {
              console.error('Errore durante il secondo tentativo di navigazione a WhatsApp Web:', retryError);
              this.updateNotificationStatus('failed', 'Errore di navigazione a WhatsApp Web');
              return false;
            }
          } else {
            console.error('Pagina non disponibile dopo la reinizializzazione');
            this.updateNotificationStatus('failed', 'Pagina WhatsApp Web non disponibile');
            return false;
          }
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
      
      // Attendi che la pagina sia caricata completamente con selettori multipli
      try {
        console.log('Attesa caricamento pannello conversazione...');
        
        // Definisci un array di selettori da provare in sequenza
        const conversationSelectors = [
          'div[data-testid="conversation-panel-wrapper"]',
          'div[role="application"][tabindex="-1"]',
          'div[data-testid="conversation-compose-box"]',
          'footer',
          'div[data-testid="conversation-compose-box-input"]',
          'div[role="textbox"]'
        ];
        
        // Prova ogni selettore con un timeout più breve
        let selectorFound = false;
        for (const selector of conversationSelectors) {
          try {
            console.log(`Tentativo con selettore: ${selector}`);
            await this.page.waitForSelector(selector, { timeout: 15000 });
            console.log(`Selettore trovato: ${selector}`);
            selectorFound = true;
            break;
          } catch (selectorError) {
            console.log(`Selettore non trovato: ${selector}`);
            // Continua con il prossimo selettore
          }
        }
        
        if (!selectorFound) {
          throw new Error('Nessun selettore di conversazione trovato');
        }
        
        // Attendi un momento extra per assicurarsi che la pagina sia completamente caricata
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Verifica se la pagina contiene elementi tipici di WhatsApp Web
        const pageContent = await this.page.evaluate(() => {
          const html = document.documentElement.innerHTML;
          return {
            hasTextbox: !!document.querySelector('div[role="textbox"]'),
            hasFooter: !!document.querySelector('footer'),
            hasComposeBox: !!document.querySelector('div[data-testid="conversation-compose-box"]'),
            hasConversationPanel: !!document.querySelector('div[data-testid="conversation-panel-wrapper"]'),
            title: document.title
          };
        });
        
        console.log('Stato elementi pagina:', JSON.stringify(pageContent));
        
        if (!pageContent.hasTextbox && !pageContent.hasComposeBox && !pageContent.hasConversationPanel) {
          throw new Error('Elementi di conversazione non trovati nella pagina');
        }
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
        await new Promise(resolve => setTimeout(resolve, 8000)); // Aumentato a 8 secondi per garantire il caricamento completo
        
        console.log('Tentativo di invio automatico del messaggio...');
        
        // Cattura uno screenshot per debug prima del tentativo di invio
        await this.captureDebugScreenshot('pre-send-attempt');
        
        // Definisci un array di selettori per la casella di testo
        const inputSelectors = [
          'div[data-testid="conversation-compose-box-input"]',
          'div[role="textbox"]',
          'div[contenteditable="true"]',
          'div[data-tab="10"]',
          'div[spellcheck="true"]'
        ];
        
        // Verifica se il messaggio è già stato inserito nella casella di testo
        let messageContent = null;
        for (const selector of inputSelectors) {
          try {
            messageContent = await this.page.evaluate((sel) => {
              const inputElement = document.querySelector(sel);
              return inputElement ? inputElement.textContent : null;
            }, selector);
            
            if (messageContent !== null) {
              console.log(`Contenuto rilevato nella casella di testo (${selector}): ${messageContent || 'vuoto'}`);
              break;
            }
          } catch (error) {
            console.log(`Errore durante la verifica del contenuto con selettore ${selector}:`, error);
          }
        }
        
        // Definisci un array di selettori per il pulsante di invio
        const sendButtonSelectors = [
          'span[data-testid="send"]',
          'button[data-testid="compose-btn-send"]',
          'button[aria-label="Invia"]',
          'button[aria-label="Send"]',
          'button[title="Invia"]',
          'button[title="Send"]',
          'span[data-icon="send"]',
          'div[role="button"][aria-label*="Invia"]',
          'div[role="button"][aria-label*="Send"]'
        ];
        
        // Verifica se il pulsante di invio è visibile e attivo
        let sendButtonInfo = { found: false, selector: '', isVisible: false, isEnabled: false };
        
        for (const selector of sendButtonSelectors) {
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
            }, selector);
            
            if (buttonInfo.found) {
              console.log(`Pulsante di invio trovato con selettore ${selector}:`, buttonInfo);
              sendButtonInfo = { ...buttonInfo, selector };
              break;
            }
          } catch (error) {
            console.log(`Errore durante la verifica del pulsante con selettore ${selector}:`, error);
          }
        }
        
        console.log(`Pulsante di invio trovato: ${sendButtonInfo.found ? 'Sì' : 'No'}, Visibile: ${sendButtonInfo.isVisible ? 'Sì' : 'No'}, Attivo: ${sendButtonInfo.isEnabled ? 'Sì' : 'No'}`);
        
        // Metodo 1: Usa executeScript per cliccare il pulsante di invio (più affidabile del click diretto)
        console.log('Tentativo di invio tramite script di click...');
        try {
          // Usa il selettore trovato o prova tutti i selettori
          const clickResult = await this.page.evaluate((selectors, foundSelector) => {
            // Funzione per tentare il click su un elemento
            const attemptClick = (element: Element) => {
              if (!element) return false;
              
              try {
                // Simula un click tramite JavaScript
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                element.dispatchEvent(clickEvent);
                return true;
              } catch (e) {
                console.log(`Errore durante il click: ${e}`);
                return false;
              }
            };
            
            // Prima prova il selettore trovato in precedenza
            if (foundSelector) {
              const button = document.querySelector(foundSelector);
              if (button && attemptClick(button)) return true;
            }
            
            // Altrimenti prova tutti i selettori
            for (const selector of selectors) {
              const button = document.querySelector(selector);
              if (button && attemptClick(button)) return true;
            }
            
            return false;
          }, sendButtonSelectors, sendButtonInfo.selector);
          
          if (clickResult) {
            console.log('Messaggio inviato tramite script di click');
            await new Promise(resolve => setTimeout(resolve, 3000)); // Attendi più tempo per confermare l'invio
            this.updateNotificationStatus('sent', 'Messaggio inviato con successo');
            return true;
          }
        } catch (scriptError) {
          console.error('Errore durante l\'esecuzione dello script di click:', scriptError);
        }
        
        // Metodo 2: Cerca il pulsante di invio e fai clic su di esso (metodo tradizionale)
        console.log('Tentativo di invio tramite pulsante...');
        try {
          // Prova tutti i selettori per il pulsante di invio
          for (const selector of sendButtonSelectors) {
            try {
              // Attendi esplicitamente che il pulsante di invio sia disponibile
              await this.page.waitForSelector(selector, { timeout: 3000 });
              const sendButton = await this.page.$(selector);
              
              if (sendButton) {
                // Usa click con opzioni per essere più affidabile
                await sendButton.click({ delay: 100 });
                console.log(`Messaggio inviato tramite clic sul pulsante (${selector})`);
                await new Promise(resolve => setTimeout(resolve, 3000)); // Attendi più tempo per confermare l'invio
                this.updateNotificationStatus('sent', 'Messaggio inviato con successo');
                return true;
              }
            } catch (selectorError) {
              console.log(`Selettore ${selector} non trovato o non cliccabile`);
              // Continua con il prossimo selettore
            }
          }
          
          // Se arriviamo qui, nessun selettore ha funzionato
          console.log('Nessun pulsante di invio trovato o cliccabile')
        } catch (clickError) {
          console.error('Errore durante il clic sul pulsante di invio:', clickError);
        }

        // Metodo 3: Premi il tasto Enter nella casella di testo
        console.log('Tentativo di invio tramite Enter nella casella di testo...');
        try {
          // Prova tutti i selettori per la casella di testo
          for (const selector of inputSelectors) {
            try {
              // Attendi esplicitamente che la casella di testo sia disponibile
              await this.page.waitForSelector(selector, { timeout: 3000 });
              const inputField = await this.page.$(selector);
              
              if (inputField) {
                console.log(`Casella di testo trovata con selettore: ${selector}`);
                
                // Assicurati che la casella di testo abbia il focus
                await inputField.click();
                await inputField.focus();
                await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa più lunga dopo il focus
                
                // Premi Enter con un ritardo per simulare meglio l'interazione umana
                await this.page.keyboard.press('Enter', { delay: 100 });
                console.log(`Messaggio inviato tramite pressione del tasto Enter nella casella (${selector})`);
                await new Promise(resolve => setTimeout(resolve, 3000)); // Attendi più tempo per confermare l'invio
                
                // Verifica se il messaggio è stato inviato
                const messageStatus = await this.page.evaluate(() => {
                  // Cerca indicatori di messaggio inviato (ad es. icone di spunta)
                  const sentIndicators = document.querySelectorAll('span[data-testid="msg-dblcheck"], span[data-testid="msg-check"]');
                  return sentIndicators.length > 0;
                });
                
                if (messageStatus) {
                  console.log('Rilevato indicatore di messaggio inviato');
                }
                
                this.updateNotificationStatus('sent', 'Messaggio inviato con successo');
                return true;
              }
            } catch (selectorError) {
              console.log(`Selettore ${selector} non trovato o non utilizzabile`);
              // Continua con il prossimo selettore
            }
          }
          
          // Se arriviamo qui, nessun selettore ha funzionato
          console.log('Nessuna casella di testo trovata o utilizzabile');
        } catch (enterError) {
          console.error('Errore durante la pressione di Enter nella casella:', enterError);
        }

        // Metodo 4: Premi il tasto Enter direttamente sulla pagina
        console.log('Tentativo di invio tramite Enter sulla pagina...');
        try {
          // Assicurati che la pagina abbia il focus
          await this.page.evaluate(() => window.focus());
          await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa più lunga dopo il focus
          
          // Cattura uno screenshot prima di premere Enter
          await this.captureDebugScreenshot('before-enter-key');
          
          // Premi Enter con un ritardo per simulare meglio l'interazione umana
          await this.page.keyboard.press('Enter', { delay: 100 });
          console.log('Messaggio inviato tramite pressione del tasto Enter sulla pagina');
          await new Promise(resolve => setTimeout(resolve, 3000)); // Attendi più tempo per confermare l'invio
          
          // Cattura uno screenshot dopo aver premuto Enter
          await this.captureDebugScreenshot('after-enter-key');
          
          // Verifica se il messaggio è stato inviato
          const messageStatus = await this.page.evaluate(() => {
            // Cerca indicatori di messaggio inviato
            const sentIndicators = document.querySelectorAll('span[data-testid="msg-dblcheck"], span[data-testid="msg-check"], div.message-out');
            return sentIndicators.length > 0;
          });
          
          if (messageStatus) {
            console.log('Rilevato indicatore di messaggio inviato dopo pressione Enter');
          }
          
          this.updateNotificationStatus('sent', 'Messaggio inviato con successo');
          return true;
        } catch (pageEnterError) {
          console.error('Errore durante la pressione di Enter sulla pagina:', pageEnterError);
        }
        
        // Metodo 5: Tenta di usare shortcut CTRL+Enter
        console.log('Tentativo di invio tramite CTRL+Enter...');
        try {
          await this.page.evaluate(() => window.focus());
          await new Promise(resolve => setTimeout(resolve, 500)); // Breve pausa dopo il focus
          
          await this.page.keyboard.down('Control');
          await this.page.keyboard.press('Enter', { delay: 100 });
          await this.page.keyboard.up('Control');
          console.log('Messaggio inviato tramite CTRL+Enter');
          await new Promise(resolve => setTimeout(resolve, 2000)); // Attendi più tempo per confermare l'invio
          this.updateNotificationStatus('sent', 'Messaggio inviato con successo');
          return true;
        } catch (ctrlEnterError) {
          console.error('Errore durante l\'utilizzo di CTRL+Enter:', ctrlEnterError);
        }
        
        // Metodo 6: Tenta di simulare l'invio tramite script diretto con approccio migliorato
        console.log('Tentativo di invio tramite simulazione diretta avanzata...');
        try {
          // Cattura uno screenshot per debug prima del tentativo di invio
          await this.captureDebugScreenshot('pre-send-attempt');
          
          const simulationResult = await this.page.evaluate(() => {
            // Cerca tutti i possibili elementi che potrebbero essere il pulsante di invio
            const possibleSendButtons = [
              document.querySelector('span[data-testid="send"]'),
              document.querySelector('button[data-testid="compose-btn-send"]'),
              document.querySelector('button[aria-label="Invia"]'),
              document.querySelector('button[aria-label="Send"]'),
              document.querySelector('button[title="Invia"]'),
              document.querySelector('button[title="Send"]'),
              document.querySelector('span[data-icon="send"]'),
              document.querySelector('div[role="button"][aria-label*="Invia"]'),
              document.querySelector('div[role="button"][aria-label*="Send"]'),
              document.querySelector('div[data-testid="send-container"] span'),
              document.querySelector('footer span[data-icon="send"]'),
              // Cerca anche per classi o attributi che potrebbero identificare il pulsante di invio
              ...Array.from(document.querySelectorAll('button')).filter(btn => 
                btn.textContent?.includes('Invia') || 
                btn.textContent?.includes('Send') ||
                btn.innerHTML?.includes('send') ||
                btn.className?.includes('send')),
              // Cerca anche elementi div con ruolo button
              ...Array.from(document.querySelectorAll('div[role="button"]')).filter(btn => 
                btn.textContent?.includes('Invia') || 
                btn.textContent?.includes('Send') ||
                btn.getAttribute('aria-label')?.includes('send') ||
                btn.getAttribute('aria-label')?.includes('Invia')),
              // Cerca elementi con icone che potrebbero essere pulsanti di invio
              ...Array.from(document.querySelectorAll('span[data-icon], div[data-icon]')),
              // Cerca elementi cliccabili all'interno del footer
              ...Array.from(document.querySelectorAll('footer div[role="button"]'))
            ].filter(Boolean); // Rimuovi elementi null o undefined
            
            console.log(`Trovati ${possibleSendButtons.length} possibili pulsanti di invio`);
            
            // Stampa informazioni sui pulsanti trovati per debug
            possibleSendButtons.forEach((btn, index) => {
              console.log(`Pulsante ${index}: ${btn?.tagName}, classe: ${btn?.className}, testo: ${btn?.textContent?.trim() || 'nessuno'}, aria-label: ${btn?.getAttribute('aria-label') || 'nessuno'}, data-icon: ${btn?.getAttribute('data-icon') || 'nessuno'}`);
            });
            
            // Tenta di cliccare su ciascun possibile pulsante
            for (const button of possibleSendButtons) {
              try {
                // Assicuriamoci che button non sia null e facciamo un cast a HTMLElement
                if (button) {
                  // Verifica se il pulsante è visibile
                  const rect = button.getBoundingClientRect();
                  const isVisible = rect.width > 0 && rect.height > 0;
                  
                  if (!isVisible) {
                    console.log('Pulsante non visibile, provo il prossimo');
                    continue;
                  }
                  
                  // Prova diversi metodi di click
                  // 1. Click standard
                  (button as HTMLElement).click();
                  
                  // 2. Evento mousedown + mouseup
                  button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                  button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                  button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                  
                  // 3. Evento pointerdown + pointerup
                  button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
                  button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
                  button.dispatchEvent(new PointerEvent('click', { bubbles: true }));
                  
                  // 4. Evento touchstart + touchend
                  button.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
                  button.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
                  
                  return true;
                }
              } catch (e) {
                console.log(`Errore durante il click sul pulsante: ${e}`);
                // Continua con il prossimo pulsante
              }
            }
            
            return false;
          });
          
          // Cattura uno screenshot per debug dopo il tentativo di invio
          await this.captureDebugScreenshot('post-send-attempt');
          
          if (simulationResult) {
            console.log('Messaggio inviato tramite simulazione diretta avanzata');
            await new Promise(resolve => setTimeout(resolve, 3000)); // Attendi più tempo per confermare l'invio
            
            // Verifica se il messaggio è stato effettivamente inviato
            const messageStatus = await this.page.evaluate(() => {
              // Cerca indicatori di messaggio inviato
              const sentIndicators = document.querySelectorAll('span[data-testid="msg-dblcheck"], span[data-testid="msg-check"], div.message-out');
              // Cerca anche se la casella di testo è vuota dopo l'invio
              const inputEmpty = !document.querySelector('div[data-testid="conversation-compose-box-input"]')?.textContent?.trim();
              return {
                hasSentIndicators: sentIndicators.length > 0,
                inputEmpty: inputEmpty
              };
            });
            
            console.log(`Verifica invio: indicatori di invio trovati: ${messageStatus.hasSentIndicators}, casella di testo vuota: ${messageStatus.inputEmpty}`);
            
            this.updateNotificationStatus('sent', 'Messaggio inviato con successo');
            return true;
          }
        } catch (simulationError) {
          console.error('Errore durante la simulazione diretta avanzata:', simulationError);
        }
        
        // Metodo 7: Tenta di inviare il messaggio usando keyboard shortcuts e combinazioni
        console.log('Tentativo di invio tramite combinazioni di tasti...');
        try {
          // Assicurati che la pagina abbia il focus
          await this.page.evaluate(() => window.focus());
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Prova diverse combinazioni di tasti comuni per l'invio
          const keyboardShortcuts = [
            async () => { await this.page?.keyboard.press('Enter'); },
            async () => { 
              await this.page?.keyboard.down('Control'); 
              await this.page?.keyboard.press('Enter'); 
              await this.page?.keyboard.up('Control'); 
            },
            async () => { 
              await this.page?.keyboard.down('Alt'); 
              await this.page?.keyboard.press('Enter'); 
              await this.page?.keyboard.up('Alt'); 
            },
            async () => { 
              await this.page?.keyboard.down('Shift'); 
              await this.page?.keyboard.press('Enter'); 
              await this.page?.keyboard.up('Shift'); 
            }
          ];
          
          for (const shortcut of keyboardShortcuts) {
            await shortcut();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Verifica se il messaggio è stato inviato
            const messageStatus = await this.page.evaluate(() => {
              // Cerca indicatori di messaggio inviato (ad es. icone di spunta)
              const sentIndicators = document.querySelectorAll('span[data-testid="msg-dblcheck"], span[data-testid="msg-check"]');
              return sentIndicators.length > 0;
            });
            
            if (messageStatus) {
              console.log('Messaggio inviato tramite combinazione di tasti');
              this.updateNotificationStatus('sent', 'Messaggio inviato con successo');
              return true;
            }
          }
        } catch (keyboardError) {
          console.error('Errore durante l\'utilizzo delle combinazioni di tasti:', keyboardError);
        }
        
        // Se tutti i metodi falliscono, registra l'errore
        console.warn('Tutti i metodi automatici di invio hanno fallito');
        this.updateNotificationStatus('failed', 'Invio automatico fallito: impossibile inviare il messaggio');
        return false;
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
   * Aggiorna lo stato di una notifica nel database
   * @param status Nuovo stato della notifica
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

      const params = errorMessage ? [status, errorMessage] : [status];
      const result = db.prepare(updateQuery).run(...params);

      console.log(`Stato della notifica aggiornato a '${status}', righe modificate: ${result.changes}`);
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