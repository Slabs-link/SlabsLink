import twilio from 'twilio';
import dotenv from 'dotenv';

// Carica le variabili d'ambiente
dotenv.config();

class TwilioService {
  private client: twilio.Twilio;
  private whatsappNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || '';

    if (!accountSid || !authToken) {
      console.error('Twilio credentials not found in environment variables');
      throw new Error('Twilio credentials not configured');
    }

    this.client = twilio(accountSid, authToken);
  }

  /**
   * Invia un messaggio WhatsApp tramite Twilio
   * @param to Numero di telefono del destinatario (formato internazionale)
   * @param message Testo del messaggio
   * @returns Promise con il risultato dell'invio
   */
  async sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
    try {
      // Formatta il numero di telefono
      const formattedNumber = this.formatPhoneNumber(to);
      
      // Prepara il numero di destinazione in formato WhatsApp
      const toWhatsApp = `whatsapp:${formattedNumber}`;
      
      // Invia il messaggio
      const result = await this.client.messages.create({
        body: message,
        from: this.whatsappNumber,
        to: toWhatsApp
      });
      
      console.log(`WhatsApp message sent to ${to}, SID: ${result.sid}`);
      return true;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      return false;
    }
  }

  /**
   * Formatta il numero di telefono in formato internazionale
   * @param phoneNumber Numero di telefono
   * @returns Numero formattato
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Rimuovi tutti i caratteri non numerici
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Assicurati che inizi con +
    if (!cleaned.startsWith('+')) {
      // Se non ha il prefisso internazionale, aggiungi +39 (Italia)
      // Modifica questo se i tuoi utenti sono di un altro paese
      if (!cleaned.startsWith('39')) {
        cleaned = '+39' + cleaned;
      } else {
        cleaned = '+' + cleaned;
      }
    }
    
    return cleaned;
  }
}

// Esporta un'istanza singleton del servizio
export default new TwilioService();