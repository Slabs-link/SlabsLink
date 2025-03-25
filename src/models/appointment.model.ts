import { Database } from 'sqlite3';
import { open } from 'sqlite';

export interface Appointment {
  id: string;
  patientName: string;
  patientPhone: string;
  date: string;
  time: string;
  notes?: string;
  googleCalendarEventId?: string;
  notificationSent: boolean;
  synced: boolean;
}

export class AppointmentModel {
  constructor(private pool: any) {
    this.pool = pool;
  }

  async create(appointment: Omit<Appointment, 'id'>): Promise<Appointment> {
    const stmt = await this.pool.run(
      `INSERT INTO appointments 
      (patient_name, patient_phone, date, time, notes, notification_sent, synced) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        appointment.patientName,
        appointment.patientPhone,
        appointment.date,
        appointment.time,
        appointment.notes,
        0,
        0
      ]
    );
    
    const newAppointment = await this.pool.get(
      'SELECT * FROM appointments WHERE id = ?',
      [stmt.lastID]
    );
    return this.mapRowToAppointment(newAppointment);
  }

  async update(id: string, appointment: Partial<Appointment>): Promise<Appointment> {
    await this.pool.run(
      `UPDATE appointments 
      SET patient_name = COALESCE(?, patient_name),
          patient_phone = COALESCE(?, patient_phone),
          date = COALESCE(?, date),
          time = COALESCE(?, time),
          notes = COALESCE(?, notes),
          synced = 0
      WHERE id = ?`,
      [
        appointment.patientName,
        appointment.patientPhone,
        appointment.date,
        appointment.time,
        appointment.notes,
        id
      ]
    );
    const updatedAppointment = await this.pool.get(
      'SELECT * FROM appointments WHERE id = ?',
      [id]
    );
    return this.mapRowToAppointment(updatedAppointment);
  }

  async getPendingNotifications(): Promise<Appointment[]> {
    const result = await this.pool.all(
      `SELECT * FROM appointments 
      WHERE notification_sent = false 
      AND date >= CURRENT_DATE`
    );
    return result.map(this.mapRowToAppointment);
  }

  async getPendingSync(): Promise<Appointment[]> {
    const result = await this.pool.all(
      `SELECT * FROM appointments 
      WHERE synced = false 
      AND date >= CURRENT_DATE`
    );
    return result.map(this.mapRowToAppointment);
  }

  async markNotificationSent(id: string): Promise<void> {
    await this.pool.run(
      'UPDATE appointments SET notification_sent = 1 WHERE id = ?',
      [id]
    );
  }

  async markSynced(id: string): Promise<void> {
    await this.pool.run(
      'UPDATE appointments SET synced = 1 WHERE id = ?',
      [id]
    );
  }

  async updateGoogleCalendarEventId(id: string, eventId: string): Promise<void> {
    await this.pool.run(
      'UPDATE appointments SET google_calendar_event_id = ? WHERE id = ?',
      [eventId, id]
    );
  }

  private mapRowToAppointment(row: any): Appointment {
    return {
      id: row.id,
      patientName: row.patient_name,
      patientPhone: row.patient_phone,
      date: row.date,
      time: row.time,
      notes: row.notes,
      googleCalendarEventId: row.google_calendar_event_id,
      notificationSent: row.notification_sent,
      synced: row.synced
    };
  }
}