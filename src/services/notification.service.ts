import axios from 'axios';
import { Template } from '../types/template';

interface NotificationVariables {
  [key: string]: string;
}

export class NotificationService {
  private apiBaseUrl = 'http://localhost:3001/api';
  private companyName = 'SlabsLink'; // Default value

  constructor() {
    // Carica il nome dell'azienda dalle impostazioni all'inizializzazione
    this.loadCompanyName();
  }

  private async loadCompanyName(): Promise<void> {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/settings/general`);
      if (response.data && response.data.clinicName) {
        this.companyName = response.data.clinicName;
      }
    } catch (error) {
      console.error('Errore nel caricamento del nome azienda:', error);
    }
  }

  public getCompanyName(): string {
    return this.companyName;
  }

  public async setCompanyName(name: string): Promise<void> {
    this.companyName = name;
  }

  /**
   * Invia una notifica WhatsApp utilizzando l'API del server
   * Questo metodo utilizza l'endpoint API del server che gestisce l'automazione WhatsApp
   * invece di tentare di utilizzare Puppeteer direttamente nel browser
   */
  public async sendWhatsAppNotification(phoneNumber: string, message: string, autoSend: boolean = false): Promise<void> {
    console.log('🔄 [WHATSAPP SERVICE] Inizio processo di invio WhatsApp');
    console.log(`📱 Numero di telefono originale: ${phoneNumber}`);
    console.log(`📝 Messaggio originale: ${message}`);
    console.log(`🔄 Modalità invio automatico: ${autoSend ? 'Sì' : 'No'}`);
    
    // Verifica se il messaggio contiene placeholder non sostituiti
    const placeholderRegex = /\{(first_name|last_name|appointment_date|appointment_time)\}/g;
    const matches = message.match(placeholderRegex);
    if (matches && matches.length > 0) {
      console.error(`❌ Messaggio contiene placeholder non sostituiti: ${matches.join(', ')}`);
      throw new Error(`Impossibile inviare il messaggio: contiene placeholder non sostituiti ${matches.join(', ')}. Assicurati di selezionare un utente e un appuntamento validi.`);
    }
    
    // Formatta il numero di telefono rimuovendo spazi e caratteri non numerici
    let formattedNumber = phoneNumber.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
    
    // Aggiungi il prefisso italiano +39 se non è già presente
    if (!formattedNumber.startsWith('+')) {
      formattedNumber = '+39' + formattedNumber;
      console.log(`📱 Aggiunto prefisso +39, numero formattato: ${formattedNumber}`);
    } else {
      console.log(`📱 Numero già con prefisso, formattato: ${formattedNumber}`);
    }
    
    // Verifica se è stato impostato WhatsApp Business
    console.log('🔍 Verifica impostazioni WhatsApp Business...');
    const settings = await this.getWhatsAppSettings();
    console.log('✅ Impostazioni WhatsApp recuperate:', settings);
    
    if (settings.useBusinessApi && settings.apiToken) {
      console.log('🔄 Utilizzo API WhatsApp Business');
      // Usa l'API di WhatsApp Business
      return this.sendWhatsAppBusinessNotification(formattedNumber, message);
    } else {
      console.log('🔄 Utilizzo WhatsApp Web tramite API del server');
      // Usa WhatsApp Web tramite l'API del server
      // Sostituisci il nome dell'azienda nel messaggio
      const messageWithCompanyName = message.replace(/SlabsLink/g, this.companyName);
      console.log(`📝 Messaggio con nome azienda sostituito: ${messageWithCompanyName}`);
      
      try {
        // Chiama l'endpoint API del server per inviare il messaggio WhatsApp
        console.log('📤 Invio richiesta al server WhatsApp...');
        console.log('📤 Payload:', {
          phoneNumber: formattedNumber,
          message: messageWithCompanyName,
          autoSend: autoSend
        });
        
        const response = await axios.post(`${this.apiBaseUrl}/whatsapp/send`, {
          phoneNumber: formattedNumber,
          message: messageWithCompanyName,
          autoSend: autoSend
        });
        
        console.log('📥 Risposta server WhatsApp:', response.data);
        
        if (!response.data.success) {
          console.error('❌ Errore restituito dal server WhatsApp:', response.data.message);
          throw new Error(response.data.message || 'Errore durante l\'invio del messaggio WhatsApp');
        }
        
        console.log(autoSend ? '✅ Messaggio WhatsApp inviato automaticamente con successo' : '✅ Chat WhatsApp aperta con successo, in attesa di invio manuale');
      } catch (error) {
        console.error('❌ Errore durante l\'invio del messaggio WhatsApp:', error);
        console.error('Dettagli errore:', (error as { response?: { data: unknown } })?.response?.data || error);
        throw new Error(`Errore durante l'invio del messaggio WhatsApp: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
      }
    }
  }

  /**
   * Invia una notifica usando l'API di WhatsApp Business
   */
  private async sendWhatsAppBusinessNotification(phoneNumber: string, message: string): Promise<void> {
    try {
      const settings = await this.getWhatsAppSettings();
      await axios.post(`${this.apiBaseUrl}/notifications/send-business`, {
        phoneNumber,
        message,
        apiToken: settings.apiToken,
        phoneNumberId: settings.phoneNumberId
      });
    } catch (error) {
      console.error('Errore nell\'invio della notifica WhatsApp Business:', error);
      throw error;
    }
  }

  /**
   * Ottiene le impostazioni di WhatsApp dal server
   */
  private async getWhatsAppSettings(): Promise<any> {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/settings/whatsapp`);
      return response.data || {};
    } catch (error) {
      console.error('Errore nel caricamento delle impostazioni WhatsApp:', error);
      return {};
    }
  }

  /**
   * Sostituisce le variabili nel template con i valori forniti
   * Supporta sia il formato {{variable}} che il formato {variable}
   */
  public replaceTemplateVariables(template: string, variables: NotificationVariables): string {
    let result = template;
    
    // Aggiungi il nome dell'azienda alle variabili se non è già presente
    const variablesWithClinic = {
      ...variables,
      clinic_name: this.companyName
    };
    
    // Sostituisci il nome dell'azienda (per retrocompatibilità)
    result = result.replace(/SlabsLink/g, this.companyName);
    
    // Sostituisci le variabili nel formato {{variable}}
    for (const [key, value] of Object.entries(variablesWithClinic)) {
      const regex = new RegExp(`\{\{${key}\}\}`, 'g');
      result = result.replace(regex, value);
    }
    
    // Sostituisci anche le variabili nel formato {variable} (formato vecchio)
    for (const [key, value] of Object.entries(variablesWithClinic)) {
      const oldFormatRegex = new RegExp(`\{${key}\}`, 'g');
      result = result.replace(oldFormatRegex, value);
    }
    
    return result;
  }

  /**
   * Estrae le variabili da un template
   */
  public extractTemplateVariables(template: string): string[] {
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = template.matchAll(regex);
    const variables: string[] = [];
    
    for (const match of matches) {
      if (match[1] && !variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    
    return variables;
  }

  /**
   * Invia una notifica automatica per un appuntamento
   */
  public async sendAppointmentNotification(
    appointmentId: number, 
    type: 'creation' | 'update' | 'cancellation'
  ): Promise<void> {
    try {
      await axios.post(`${this.apiBaseUrl}/notifications/appointment`, {
        appointmentId,
        notificationType: type
      });
    } catch (error) {
      console.error(`Errore nell'invio della notifica automatica per l'appuntamento ${appointmentId}:`, error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();