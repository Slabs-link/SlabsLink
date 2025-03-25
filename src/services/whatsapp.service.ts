import { Builder, By, until, WebDriver } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/chrome';
import { AppointmentModel } from '../models/appointment.model';
import { LicenseModel } from '../models/license.model';

export class WhatsAppService {
  private driver: WebDriver | null = null;
  private isAuthenticated = false;
  private browserPath: string = '';
  private dataPath: string = '';

  constructor(
    private licenseModel: LicenseModel,
    private appointmentModel: AppointmentModel
  ) {}

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

    const options = new Options()
      .addArguments(`user-data-dir=${this.dataPath}`)
      .setChromeBinaryPath(this.browserPath);

    this.driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();

    await this.driver.get('https://web.whatsapp.com');
    
    // Wait for QR code scan and authentication
    try {
      await this.driver.wait(until.elementLocated(By.css('[data-testid="chat-list"]')), 60000);
      this.isAuthenticated = true;
    } catch (error) {
      throw new Error('WhatsApp authentication failed or timed out');
    }
  }

  async sendNotification(phoneNumber: string, message: string): Promise<void> {
    if (!this.driver || !this.isAuthenticated) {
      throw new Error('WhatsApp service not authenticated');
    }

    // Format phone number and create chat URL
    const formattedNumber = phoneNumber.replace(/[^0-9]/g, '');
    await this.driver.get(`https://web.whatsapp.com/send?phone=${formattedNumber}`);

    // Wait for chat to load
    const messageInput = await this.driver.wait(
      until.elementLocated(By.css('[data-testid="conversation-compose-box-input"]')),
      20000
    );

    // Send message
    await messageInput.sendKeys(message);
    await this.driver.findElement(By.css('[data-testid="send"]')).click();

    // Wait for message to be sent
    await this.driver.sleep(2000);
  }

  async sendAppointmentConfirmation(appointment: AppointmentModel): Promise<void> {
    const message = `Gentile paziente,\nLe confermiamo l'appuntamento per il giorno ${appointment.date} alle ore ${appointment.time}.\nLa aspettiamo!`;
    await this.sendNotification(appointment.patientPhone, message);
  }

  async sendAppointmentReminder(appointment: AppointmentModel): Promise<void> {
    const message = `Gentile paziente,\nLe ricordiamo l'appuntamento di domani alle ore ${appointment.time}.\nLa aspettiamo!`;
    await this.sendNotification(appointment.patientPhone, message);
  }

  async processPendingNotifications(): Promise<void> {
    const pendingAppointments = await this.appointmentModel.getPendingNotifications();
    for (const appointment of pendingAppointments) {
      try {
        await this.sendAppointmentConfirmation(appointment);
        await this.appointmentModel.markNotificationSent(appointment.id);
      } catch (error) {
        console.error(`Failed to send notification for appointment ${appointment.id}:`, error);
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.driver) {
      await this.driver.quit();
      this.driver = null;
      this.isAuthenticated = false;
    }
  }
}