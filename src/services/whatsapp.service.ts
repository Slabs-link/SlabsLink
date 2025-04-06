// Import models
import { AppointmentModel, Appointment } from '../models/appointment.model';
import { LicenseModel } from '../models/license.model';

// No direct Selenium imports in browser environment
// Instead, we'll use the server API for all WhatsApp operations

export class WhatsAppService {
  private isAuthenticated = false;
  private isBrowserEnvironment: boolean;
  private browserPath!: string;
  private dataPath!: string;

  constructor(
    private licenseModel: LicenseModel,
    private appointmentModel: AppointmentModel
  ) {
    // Always assume browser environment for client-side code
    this.isBrowserEnvironment = true;
  }

  async isServiceEnabled(): Promise<boolean> {
    return await this.licenseModel.hasWhatsAppIntegration();
  }

  isServiceAuthenticated(): boolean {
    return this.isAuthenticated;
  }

  configure(browserPath: string, dataPath: string): void {
    this.browserPath = browserPath;
    this.dataPath = dataPath;
  }

  async authenticate(): Promise<void> {
    if (!await this.isServiceEnabled()) {
      throw new Error('WhatsApp integration not enabled in license');
    }

    // In browser environment, we use the server API for authentication
    if (this.isBrowserEnvironment) {
      console.log('Using server-side WhatsApp service for authentication');
      
      // Set authenticated state for browser environment
      // The actual authentication happens on the server
      this.isAuthenticated = true;
      return;
    }
    
    // This code should never run in browser environment
    console.error('Direct WhatsApp authentication not supported in this environment');
    throw new Error('WhatsApp authentication method not supported in this environment');
  }
  

  async sendNotification(phoneNumber: string, message: string): Promise<void> {
    // Always use the server-side WhatsApp service in browser environment
    try {
      // Call the server-side WhatsApp service
      const response = await fetch('http://localhost:3001/api/notifications/whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          message
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send WhatsApp notification');
      }
      
      return;
    } catch (error) {
      console.error('Error sending WhatsApp notification via server:', error);
      throw new Error('Failed to send WhatsApp notification: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
  

  async sendAppointmentConfirmation(appointment: Appointment): Promise<void> {
    const message = `Gentile paziente,\nLe confermiamo l'appuntamento per il giorno ${appointment.date} alle ore ${appointment.time}.\nLa aspettiamo!`;
    await this.sendNotification(appointment.patientPhone, message);
  }

  async sendAppointmentReminder(appointment: Appointment): Promise<void> {
    const message = `Gentile paziente,\nLe ricordiamo l'appuntamento di domani alle ore ${appointment.time}.\nLa aspettiamo!`;
    await this.sendNotification(appointment.patientPhone, message);
  }

  async processPendingNotifications(): Promise<void> {
    const pendingAppointments = await this.appointmentModel.getPendingNotifications();
    for (const appointment of pendingAppointments) {
      try {
        await this.sendAppointmentConfirmation(appointment);
        await this.appointmentModel.markNotificationSent(appointment.id);
      } catch (error: any) {
        console.error(`Failed to send notification for appointment ${appointment.id}:`, error);
      }
    }
  }
  
  /**
   * Invia immediatamente una notifica per un nuovo appuntamento
   * @param appointmentId ID dell'appuntamento
   */
  async sendImmediateNotification(appointmentId: string): Promise<void> {
    try {
      // Always use the server-side API in browser environment
      try {
        // Call the server-side notification API
        const response = await fetch(`http://localhost:3001/api/notifications/appointment/${appointmentId}/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to send immediate notification');
        }
        
        return;
      } catch (error: any) {
        console.error(`Error sending immediate notification via server for appointment ${appointmentId}:`, error);
        throw new Error('Failed to send immediate notification: ' + (error instanceof Error ? error.message : String(error)));
      }
    } catch (error: any) {
      console.error(`Failed to send immediate notification for appointment ${appointmentId}:`, error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    // In browser environment, just reset the state
    this.isAuthenticated = false;
    return;
  }
}

// Esporta un'istanza del servizio WhatsApp
// Utilizziamo any per evitare errori di tipo con Pool
// In un'implementazione reale, qui dovrebbe essere passata una connessione al database valida
export const whatsAppService = new WhatsAppService(
  new LicenseModel(null as any),
  new AppointmentModel(null as any)
);