import { Database } from 'better-sqlite3';
import { getDatabase } from '../src/db/db-sqlite';

export interface Appointment {
  id?: number;
  title: string;
  patient_id: number;
  date: string; // Maps to appointment_date in database
  time: string; // Maps to appointment_time in database
  appointment_date?: string; // Direct database column name
  appointment_time?: string; // Direct database column name
  duration: number;
  notes?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  created_at?: Date;
  updated_at?: Date;
}

export const AppointmentModel = {
  async findAll() {
    const query = `
      SELECT a.*, (u.first_name || ' ' || u.last_name) as patient_name, u.first_name, u.last_name
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      ORDER BY a.appointment_date, a.appointment_time
    `;
    const db = getDatabase();
    const result = db.prepare(query).all();
    return result;
  },

  async findById(id: number) {
    const query = `
      SELECT a.*, (u.first_name || ' ' || u.last_name) as patient_name, u.first_name, u.last_name
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      WHERE a.id = ?
    `;
    const db = getDatabase();
    const result = db.prepare(query).get(id);
    return result;
  },

  async create(appointment: Appointment) {
    const { title, patient_id, date, time, duration, notes, status } = appointment;
    const query = `
      INSERT INTO appointments (title, patient_id, appointment_date, appointment_time, duration, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const db = getDatabase();
    const result = db.prepare(query).run(title, patient_id, date, time, duration, notes, status);
    
    if (result.lastInsertRowid) {
      return this.findById(result.lastInsertRowid as number);
    }
    return null;
  },

  async update(id: number, appointment: Appointment) {
    const { title, patient_id, date, time, duration, notes, status } = appointment;
    const query = `
      UPDATE appointments
      SET title = ?, patient_id = ?, appointment_date = ?, appointment_time = ?, 
          duration = ?, notes = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const db = getDatabase();
    const result = db.prepare(query).run(title, patient_id, date, time, duration, notes, status, id);
    
    if (result.changes > 0) {
      return this.findById(id);
    }
    return null;
  },

  async delete(id: number) {
    // First get the appointment to return it after deletion
    const appointment = await this.findById(id);
    if (!appointment) return null;
    
    const query = 'DELETE FROM appointments WHERE id = ?';
    const db = getDatabase();
    const result = db.prepare(query).run(id);
    
    if (result.changes > 0) {
      return appointment;
    }
    return null;
  },

  async findByPatientId(patientId: number) {
    const query = `
      SELECT a.*, (u.first_name || ' ' || u.last_name) as patient_name, u.first_name, u.last_name
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      WHERE a.patient_id = ?
      ORDER BY a.appointment_date, a.appointment_time
    `;
    const db = getDatabase();
    const result = db.prepare(query).all(patientId);
    return result;
  },

  async findByDateRange(startDate: string, endDate: string) {
    const query = `
      SELECT a.*, (u.first_name || ' ' || u.last_name) as patient_name, u.first_name, u.last_name
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      WHERE a.appointment_date BETWEEN ? AND ?
      ORDER BY a.appointment_date, a.appointment_time
    `;
    const db = getDatabase();
    const result = db.prepare(query).all(startDate, endDate);
    return result;
  }
};