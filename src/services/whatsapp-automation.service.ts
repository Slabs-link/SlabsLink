/**
 * Servizio per l'automazione dell'invio di messaggi WhatsApp
 * Questo servizio utilizza Puppeteer per interagire con WhatsApp Web
 */

import { Browser, Page } from 'puppeteer';

export class WhatsAppAutomationService {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isInitialized = false;
  private isAuthenticated = false;

  /**
   * Inizializza il browser Puppeteer e apre WhatsApp Web
   * @param browserWSEndpoint Endpoint WebSocket del browser già aperto (opzionale)
   */
  async initialize(browserWSEndpoint?: string): Promise<boolean> {
    try {
      // Importa dinamicamente puppeteer per evitare problemi di caricamento
      const puppeteer = await import('puppeteer');
      
      if (browserWSEndpoint) {
        // Connessione a un browser esistente
        this.browser = await puppeteer.default.connect({ browserWSEndpoint });
      } else {
        // Avvia un nuovo browser
        this.browser = await puppeteer.default.launch({
          headless: false, // Deve essere visibile per la scansione del QR code
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      }

      // Apri una nuova pagina
      this.page = await this.browser.newPage();
      
      // Imposta viewport per simulare uno schermo desktop
      await this.page.setViewport({ width: 1280, height: 800 });
      
      this.isInitialized = true;
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
   * @returns true se l'utente è autenticato, false altrimenti
   */
  async checkAuthenticationStatus(): Promise<boolean> {
    if (!this.isReady() || !this.page) {
      console.error('Puppeteer non è stato inizializzato');
      return false;
    }
    
    try {
      // Naviga a WhatsApp Web
      await this.page.goto('https://web.whatsapp.com/', { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Verifica se è presente il QR code (utente non autenticato)
      const qrCode = await this.page.$('div[data-testid="qrcode"]');
      
      if (qrCode) {
        console.log('Utente non autenticato su WhatsApp Web, QR code presente');
        this.isAuthenticated = false;
        return false;
      }
      
      // Verifica se è presente il pannello delle chat (utente autenticato)
      const chatList = await this.page.$('div[data-testid="chat-list"]');
      
      if (chatList) {
        console.log('Utente autenticato su WhatsApp Web');
        this.isAuthenticated = true;
        return true;
      }
      
      // Se non troviamo né il QR code né il pannello delle chat, consideriamo l'utente non autenticato
      console.log('Stato di autenticazione non determinabile, considerato non autenticato');
      this.isAuthenticated = false;
      return false;
    } catch (error) {
      console.error('Errore durante la verifica dello stato di autenticazione:', error);
      this.isAuthenticated = false;
      return false;
    }
  }

  /**
   * Naviga su WhatsApp Web con un messaggio precompilato
   * @param phoneNumber Numero di telefono del destinatario
   * @param message Messaggio da inviare
   * @returns Un oggetto con lo stato dell'operazione e informazioni aggiuntive
   */
  async navigateToWhatsAppChat(phoneNumber: string, message: string): Promise<{ success: boolean; needsAuthentication?: boolean; error?: string }> {
    if (!this.isReady() || !this.page) {
      console.error('Puppeteer non è stato inizializzato');
      return { success: false, error: 'Puppeteer non è stato inizializzato' };
    }

    try {
      // Verifica lo stato di autenticazione prima di procedere
      const isAuthenticated = await this.checkAuthenticationStatus();
      
      if (!isAuthenticated) {
        console.log('Utente non autenticato su WhatsApp Web, è necessario scansionare il QR code');
        return { success: false, needsAuthentication: true, error: 'Autenticazione richiesta' };
      }

      // Formatta il numero di telefono
      let formattedNumber = phoneNumber.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
      
      // Aggiungi il prefisso italiano +39 se non è già presente
      if (!formattedNumber.startsWith('+')) {
        formattedNumber = '+39' + formattedNumber;
      }

      // Crea l'URL per WhatsApp Web con il messaggio precompilato
      const whatsappUrl = `https://web.whatsapp.com/send?phone=${formattedNumber}&text=${encodeURIComponent(message)}`;
      
      // Naviga all'URL di WhatsApp Web
      await this.page.goto(whatsappUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // Verifica se appare il messaggio di errore per numero non valido
      const invalidNumberError = await this.page.$('div[data-testid="alert-phone-number"]')
        .catch(() => null);
      
      if (invalidNumberError) {
        console.error('Numero di telefono non valido o non registrato su WhatsApp');
        return { success: false, error: 'Numero di telefono non valido o non registrato su WhatsApp' };
      }
      
      // Attendi che la pagina sia caricata completamente
      await this.page.waitForSelector('div[data-testid="conversation-panel-wrapper"]', { timeout: 60000 })
        .catch(() => {
          // Verifica se è apparso il QR code (sessione scaduta)
          this.page?.waitForSelector('div[data-testid="qrcode"]', { timeout: 5000 })
            .then(() => {
              console.log('Sessione scaduta, è necessario scansionare nuovamente il QR code');
              this.isAuthenticated = false;
            })
            .catch(() => {
              console.log('Attesa per il pannello di conversazione scaduta, motivo sconosciuto');
            });
        });
      
      // Verifica nuovamente se siamo autenticati
      if (!this.isAuthenticated) {
        return { success: false, needsAuthentication: true, error: 'Sessione scaduta, autenticazione richiesta' };
      }
      
      return { success: true };
    } catch (error) {
      console.error('Errore durante la navigazione su WhatsApp Web:', error);
      return { success: false, error: `Errore durante la navigazione: ${error instanceof Error ? error.message : 'Errore sconosciuto'}` };
    }
  }

  /**
   * Cerca il pulsante di invio e simula il click o preme Enter
   * @returns Un oggetto con lo stato dell'operazione e informazioni aggiuntive
   */
  async sendMessage(): Promise<{ success: boolean; needsAuthentication?: boolean; error?: string }> {
    if (!this.isReady() || !this.page) {
      console.error('Puppeteer non è stato inizializzato');
      return { success: false, error: 'Puppeteer non è stato inizializzato' };
    }

    try {
      // Verifica lo stato di autenticazione prima di procedere
      if (!this.isAuthenticated) {
        const isAuthenticated = await this.checkAuthenticationStatus();
        if (!isAuthenticated) {
          console.log('Utente non autenticato su WhatsApp Web, è necessario scansionare il QR code');
          return { success: false, needsAuthentication: true, error: 'Autenticazione richiesta' };
        }
      }

      // Attendi che la pagina sia caricata completamente
      await this.page.waitForSelector('div[data-testid="conversation-panel-wrapper"]', { timeout: 10000 })
        .catch(() => {
          // Verifica se è apparso il QR code (sessione scaduta)
          return this.page?.waitForSelector('div[data-testid="qrcode"]', { timeout: 5000 })
            .then(() => {
              console.log('Sessione scaduta, è necessario scansionare nuovamente il QR code');
              this.isAuthenticated = false;
              throw new Error('Sessione scaduta, autenticazione richiesta');
            })
            .catch(() => {
              throw new Error('Pannello di conversazione non trovato. Assicurati di essere loggato su WhatsApp Web.');
            });
        });

      // Metodo 1: Cerca il pulsante di invio e fai clic su di esso
      const sendButton = await this.page.$('span[data-testid="send"]');
      if (sendButton) {
        await sendButton.click();
        console.log('Messaggio inviato tramite clic sul pulsante');
        return { success: true };
      }

      // Metodo 2: Premi il tasto Enter nella casella di testo
      const inputField = await this.page.$('div[data-testid="conversation-compose-box-input"]');
      if (inputField) {
        await inputField.focus();
        await this.page.keyboard.press('Enter');
        console.log('Messaggio inviato tramite pressione del tasto Enter');
        return { success: true };
      }

      // Se entrambi i metodi falliscono, prova a premere Enter direttamente sulla pagina
      await this.page.keyboard.press('Enter');
      console.log('Messaggio inviato tramite pressione del tasto Enter sulla pagina');
      return { success: true };
    } catch (error) {
      console.error('Errore durante l\'invio del messaggio:', error);
      return { 
        success: false, 
        needsAuthentication: error instanceof Error && error.message.includes('autenticazione'),
        error: error instanceof Error ? error.message : 'Errore sconosciuto durante l\'invio del messaggio'
      };
    }
  }

  /**
   * Chiude il browser Puppeteer
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isInitialized = false;
    }
  }

  /**
   * Ottiene l'endpoint WebSocket del browser per riconnettersi in seguito
   */
  getBrowserWSEndpoint(): string | null {
    return this.browser ? this.browser.wsEndpoint() : null;
  }
}

// Esporta un'istanza del servizio
export const whatsAppAutomationService = new WhatsAppAutomationService();