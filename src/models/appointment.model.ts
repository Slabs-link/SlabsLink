import { Pool } from 'pg';

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
  constructor(private pool: Pool) {}

  async create(appointment: Omit<Appointment, 'id'>): Promise<Appointment> {
    const result = await this.pool.query(
      `INSERT INTO appointments 
      (patient_name, patient_phone, date, time, notes, notification_sent, synced) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING *`,
      [
        appointment.patientName,
        appointment.patientPhone,
        appointment.date,
        appointment.time,
        appointment.notes,
        false,
        false
      ]
    );
    return this.mapRowToAppointment(result.rows[0]);
  }

  async update(id: string, appointment: Partial<Appointment>): Promise<Appointment> {
    const result = await this.pool.query(
      `UPDATE appointments 
      SET patient_name = COALESCE($1, patient_name),
          patient_phone = COALESCE($2, patient_phone),
          date = COALESCE($3, date),
          time = COALESCE($4, time),
          notes = COALESCE($5, notes),
          synced = false
      WHERE id = $6
      RETURNING *`,
      [
        appointment.patientName,
        appointment.patientPhone,
        appointment.date,
        appointment.time,
        appointment.notes,
        id
      ]
    );
    return this.mapRowToAppointment(result.rows[0]);
  }

  async getPendingNotifications(): Promise<Appointment[]> {
    const result = await this.pool.query(
      `SELECT * FROM appointments 
      WHERE notification_sent = false 
      AND date >= CURRENT_DATE`
    );
    return result.rows.map(this.mapRowToAppointment);
  }

  async getPendingSync(): Promise<Appointment[]> {
    const result = await this.pool.query(
      `SELECT * FROM appointments 
      WHERE synced = false 
      AND date >= CURRENT_DATE`
    );
    return result.rows.map(this.mapRowToAppointment);
  }

  async markNotificationSent(id: string): Promise<void> {
    await this.pool.query(
      'UPDATE appointments SET notification_sent = true WHERE id = $1',
      [id]
    );
  }

  async markSynced(id: string): Promise<void> {
    await this.pool.query(
      'UPDATE appointments SET synced = true WHERE id = $1',
      [id]
    );
  }

  async updateGoogleCalendarEventId(id: string, eventId: string): Promise<void> {
    await this.pool.query(
      'UPDATE appointments SET google_calendar_event_id = $1 WHERE id = $2',
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