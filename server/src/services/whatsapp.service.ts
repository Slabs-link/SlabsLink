import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class WhatsAppService {
  private apiToken: string;
  private phoneNumberId: string;
  private version: string;
  private baseUrl: string;
  private isConfigured: boolean;

  constructor() {
    this.apiToken = process.env.WHATSAPP_API_TOKEN || '';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    this.version = process.env.WHATSAPP_VERSION || 'v17.0';
    this.baseUrl = `https://graph.facebook.com/${this.version}/${this.phoneNumberId}`;
    
    // Check if WhatsApp is configured
    this.isConfigured = !!(this.apiToken && this.phoneNumberId);
    
    if (!this.isConfigured) {
      console.warn('WhatsApp Business API not fully configured. Running in simulation mode.');
    } else {
      console.log('WhatsApp Business API configured successfully.');
    }
  }

  /**
   * Send a WhatsApp message using the WhatsApp Business API
   * @param to Recipient's phone number (international format)
   * @param message Message text
   * @returns Promise with the result of the operation
   */
  async sendMessage(to: string, message: string, useWebWhatsApp: boolean = false): Promise<boolean> {
    try {
      // Format the phone number
      const formattedNumber = this.formatPhoneNumber(to);
      
      // Verifica se è richiesto l'uso di WhatsApp Web
      if (useWebWhatsApp || process.env.USE_WHATSAPP_WEB === 'true') {
        try {
          // Importa dinamicamente il servizio WhatsApp Web
          const { default: WhatsAppWebService } = await import('./whatsapp-web.service');
          
          // Tenta di inviare il messaggio tramite WhatsApp Web
          const success = await WhatsAppWebService.sendMessage(to, message, true);
          if (success) {
            console.log(`WhatsApp Web message sent to ${to}`);
            return true;
          }
          
          // Se fallisce, NON continuare con il metodo standard ma restituisci false
          // per evitare il doppio invio del messaggio
          console.log('WhatsApp Web sending failed, returning false');
          return false;
        } catch (webError) {
          console.error('Error using WhatsApp Web service:', webError);
          // NON continuare con il metodo standard ma restituisci false
          return false;
        }
      }
      
      // If WhatsApp is not configured, simulate sending
      if (!this.isConfigured) {
        console.log(`[SIMULATION] Sending WhatsApp message to ${formattedNumber}: ${message}`);
        // Simulate 80% success rate
        const success = Math.random() > 0.2;
        if (!success) {
          throw new Error('Simulated WhatsApp message failure');
        }
        return true;
      }
      
      // Prepare the request body for real WhatsApp API
      const data = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedNumber,
        type: 'text',
        text: {
          preview_url: false,
          body: message
        }
      };
      
      // Send the request to WhatsApp Business API
      const response = await axios.post(
        `${this.baseUrl}/messages`,
        data,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiToken}`
          }
        }
      );
      
      console.log(`WhatsApp message sent to ${to}, response:`, response.data);
      return true;
    } catch (error: any) {
      console.error('Error sending WhatsApp message:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Format phone number to international format
   * @param phoneNumber Phone number
   * @returns Formatted phone number
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-numeric characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Make sure it starts with country code
    if (!cleaned.startsWith('39') && !cleaned.startsWith('+39')) {
      // If it doesn't have the international prefix, add +39 (Italy)
      // Change this if your users are from a different country
      cleaned = '39' + cleaned;
    } else if (cleaned.startsWith('+')) {
      // Remove the + if present
      cleaned = cleaned.substring(1);
    }
    
    return cleaned;
  }

  /**
   * Process a template message with variables
   * @param template Template content with placeholders
   * @param variables Object with variables to replace
   * @returns Processed message
   */
  processTemplate(template: string, variables: Record<string, string>): string {
    let processedMessage = template;
    
    // Replace all variables in the format {{variable_name}}
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      processedMessage = processedMessage.replace(placeholder, value);
    }
    
    return processedMessage;
  }
}

// Export a singleton instance of the service
export default new WhatsAppService();