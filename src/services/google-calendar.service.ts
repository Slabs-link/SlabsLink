import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { AppointmentModel } from '../models/appointment.model';
import { LicenseModel } from '../models/license.model';

export class GoogleCalendarService {
  private oauth2Client: OAuth2Client | null = null;
  private calendar: calendar_v3.Calendar | null = null;

  constructor(
    private licenseModel: LicenseModel,
    private appointmentModel: AppointmentModel
  ) {}

  async isServiceEnabled(): Promise<boolean> {
    return await this.licenseModel.hasGoogleCalendarIntegration();
  }

  isServiceAuthenticated(): boolean {
    return this.oauth2Client !== null && this.calendar !== null;
  }

  configure(clientId: string, clientSecret: string, redirectUri: string): void {
    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );
  }

  getAuthUrl(): string {
    if (!this.oauth2Client) {
      throw new Error('Google Calendar service not configured');
    }

    const scopes = ['https://www.googleapis.com/auth/calendar'];
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
    });
  }

  async setAuthCode(code: string): Promise<void> {
    if (!this.oauth2Client) {
      throw new Error('Google Calendar service not configured');
    }

    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  async createCalendarEvent(appointment: AppointmentModel): Promise<string> {
    if (!this.calendar) {
      throw new Error('Google Calendar service not authenticated');
    }

    const event = {
      summary: `Appuntamento: ${appointment.patientName}`,
      description: appointment.notes,
      start: {
        dateTime: new Date(`${appointment.date}T${appointment.time}`).toISOString(),
        timeZone: 'Europe/Rome',
      },
      end: {
        dateTime: new Date(`${appointment.date}T${appointment.time}`)
          .setHours(new Date(`${appointment.date}T${appointment.time}`).getHours() + 1)
          .toISOString(),
        timeZone: 'Europe/Rome',
      },
    };

    const response = await this.calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    return response.data.id || '';
  }

  async updateCalendarEvent(appointment: AppointmentModel): Promise<void> {
    if (!this.calendar || !appointment.googleCalendarEventId) {
      throw new Error('Google Calendar service not authenticated or event ID missing');
    }

    const event = {
      summary: `Appuntamento: ${appointment.patientName}`,
      description: appointment.notes,
      start: {
        dateTime: new Date(`${appointment.date}T${appointment.time}`).toISOString(),
        timeZone: 'Europe/Rome',
      },
      end: {
        dateTime: new Date(`${appointment.date}T${appointment.time}`)
          .setHours(new Date(`${appointment.date}T${appointment.time}`).getHours() + 1)
          .toISOString(),
        timeZone: 'Europe/Rome',
      },
    };

    await this.calendar.events.update({
      calendarId: 'primary',
      eventId: appointment.googleCalendarEventId,
      requestBody: event,
    });
  }

  async deleteCalendarEvent(eventId: string): Promise<void> {
    if (!this.calendar) {
      throw new Error('Google Calendar service not authenticated');
    }

    await this.calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    });
  }

  async syncAppointments(): Promise<void> {
    if (!await this.isServiceEnabled()) {
      return;
    }

    const appointments = await this.appointmentModel.getPendingSync();
    for (const appointment of appointments) {
      try {
        if (!appointment.googleCalendarEventId) {
          const eventId = await this.createCalendarEvent(appointment);
          await this.appointmentModel.updateGoogleCalendarEventId(appointment.id, eventId);
        } else {
          await this.updateCalendarEvent(appointment);
        }
        await this.appointmentModel.markSynced(appointment.id);
      } catch (error) {
        console.error(`Failed to sync appointment ${appointment.id}:`, error);
      }
    }
  }
}