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
   * Invia una notifica WhatsApp aprendo WhatsApp Web o usando l'API Business
   */
  public async sendWhatsAppNotification(phoneNumber: string, message: string): Promise<void> {
    // Formatta il numero di telefono rimuovendo spazi e caratteri non numerici
    let formattedNumber = phoneNumber.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
    
    // Aggiungi il prefisso italiano +39 se non è già presente
    if (!formattedNumber.startsWith('+')) {
      formattedNumber = '+39' + formattedNumber;
    }
    
    // Verifica se è stato impostato WhatsApp Business
    const settings = await this.getWhatsAppSettings();
    
    if (settings.useBusinessApi && settings.apiToken) {
      // Usa l'API di WhatsApp Business
      return this.sendWhatsAppBusinessNotification(formattedNumber, message);
    } else {
      // Usa WhatsApp Web
      // Sostituisci il nome dell'azienda nel messaggio
      const messageWithCompanyName = message.replace(/SlabsLink/g, this.companyName);
      
      // Crea l'URL per WhatsApp Web
      const whatsappUrl = `https://web.whatsapp.com/send?phone=${formattedNumber}&text=${encodeURIComponent(messageWithCompanyName)}`;
      
      // Apri WhatsApp Web in una nuova finestra
      window.open(whatsappUrl, '_blank');
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
   */
  public replaceTemplateVariables(template: string, variables: NotificationVariables): string {
    let result = template;
    
    // Sostituisci il nome dell'azienda
    result = result.replace(/SlabsLink/g, this.companyName);
    
    // Sostituisci le variabili nel formato {{variable}}
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\{\{${key}\}\}`, 'g');
      result = result.replace(regex, value);
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