import { Request, Response } from 'express';
import { getDatabase } from '../config/database-sqlite';
import { getAppointmentTypeByName } from './appointment-types-sqlite.controller';
import { GoogleCalendarService } from '../services/google-calendar.service';

// Sync appointments with Google Calendar
export const syncAppointmentsWithGoogleCalendar = async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const calendarService = new GoogleCalendarService();
    
    const appointments = db.prepare(`
      SELECT a.*, u.first_name, u.last_name
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      WHERE a.synced = 0
    `).all() as Appointment[];

    const results = [];
    
    for (const appointment of appointments) {
      try {
        const eventId = await calendarService.createCalendarEvent(appointment);
        
        db.prepare(`
          UPDATE appointments SET
            synced = 1,
            google_calendar_event_id = ?
          WHERE id = ?
        `).run(eventId, appointment.id);
        
        results.push({
          id: appointment.id,
          status: 'synced',
          eventId: eventId
        });
      } catch (error: any) {
        results.push({
          id: appointment.id,
          status: 'failed',
          error: error.message
        });
      }
    }

    return res.json({
      synced: results.length,
      results: results
    });

  } catch (error: any) {
    console.error('Sync error:', error);
    return res.status(500).json({
      message: 'Error syncing appointments',
      error: error.message
    });
  }
};


// Define interfaces for database results
interface AppointmentStats {
  completed: number;
  cancelled: number;
  total: number;
}

interface Patient {
  id: number;
  first_name: string;
  last_name: string;
  phone?: string;
}

interface NotificationTemplate {
  id: number;
  content: string;
  type?: string;
  is_system?: number;
}

interface Appointment {
  id: number;
  title?: string;
  patient_id: number;
  date: string;
  time: string;
  appointment_date: string;
  appointment_time: string;
  duration: number;
  notes?: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  user_id?: number;
  first_name?: string;
  last_name?: string;
  patient_name: string;
  synced?: number;
  google_calendar_event_id?: string | null;
  appointment_type_id?: number | null;
  appointment_type_name?: string;
}

// Sync all appointments with Google Calendar
export const syncAllAppointmentsWithGoogleCalendar = async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const calendarService = new GoogleCalendarService();
    
    const appointments = db.prepare(`
      SELECT a.*, u.first_name, u.last_name
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      WHERE a.synced = 0
    `).all() as Appointment[];

    const results = [];
    
    for (const appointment of appointments) {
      try {
        const eventId = await calendarService.createCalendarEvent(appointment);
        
        db.prepare(`
          UPDATE appointments SET
            synced = 1,
            google_calendar_event_id = ?
          WHERE id = ?
        `).run(eventId, appointment.id);
        
        results.push({
          id: appointment.id,
          status: 'synced',
          eventId: eventId
        });
      } catch (error: any) {
        results.push({
          id: appointment.id,
          status: 'failed',
          error: error.message
        });
      }
    }

    return res.json({
      synced: results.length,
      results: results
    });

  } catch (error: any) {
    console.error('Sync error:', error);
    return res.status(500).json({
      message: 'Error syncing appointments',
      error: error.message
    });
  }
};

export const getAppointmentsStats = async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        COUNT(*) as total
      FROM appointments
    `).get() as AppointmentStats;
    
    return res.json({
      completed: stats.completed || 0,
      cancelled: stats.cancelled || 0,
      total: stats.total || 0
    });
  } catch (error: any) {
    console.error('Error getting appointments stats:', error);
    return res.status(500).json({ 
      message: 'Error retrieving appointments statistics', 
      error: error.message 
    });
  }
};



// Get all appointments
export const getAllAppointments = async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    
    const appointments = db.prepare(`
      SELECT a.*, u.first_name || ' ' || u.last_name as patient_name, u.first_name, u.last_name, 
             t.name as appointment_type_name, t.id as appointment_type_id
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      LEFT JOIN appointment_types t ON a.appointment_type_id = t.id
      ORDER BY a.appointment_date DESC
    `).all();
    
    return res.json(appointments);
  } catch (error: any) {
    console.error('Error getting appointments:', error);
    return res.status(500).json({ 
      message: 'Error retrieving appointments', 
      error: error.message 
    });
  }
};



// Get appointment by ID
export const getAppointmentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const appointment = db.prepare(`
      SELECT a.*, u.first_name || ' ' || u.last_name as patient_name, u.first_name, u.last_name,
             t.name as appointment_type_name, t.id as appointment_type_id
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      LEFT JOIN appointment_types t ON a.appointment_type_id = t.id
      WHERE a.id = ?
    `).get(id);
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    return res.json(appointment);
  } catch (error: any) {
    console.error('Error getting appointment:', error);
    return res.status(500).json({ 
      message: 'Error retrieving appointment', 
      error: error.message 
    });
  }
};



// Create new appointment
export const createAppointment = async (req: Request, res: Response) => {
  try {
    const { 
      title,
      appointment_type_id: receivedTypeId,
      patient_id, 
      appointment_date, 
      appointment_time, 
      duration, 
      notes, 
      status = 'scheduled',
      send_notification = false
    } = req.body;
    
    // Validate required fields
    if (!patient_id || !appointment_date || !appointment_time || !duration) {
      return res.status(400).json({ 
        message: 'Patient ID, appointment date, time and duration are required' 
      });
    }
    
    // Gestione del tipo di appuntamento
    // Usa direttamente il valore ricevuto dal frontend, anche se è null
    let appointment_type_id = receivedTypeId;
    
    const db = getDatabase();
    
    // Check if patient exists
    const patientExists = db.prepare('SELECT id FROM users WHERE id = ?').get(patient_id);
    if (!patientExists) {
      return res.status(400).json({ message: 'Patient not found' });
    }
    
    // Begin transaction
    db.prepare('BEGIN TRANSACTION').run();
    
    try {
      // Insert appointment
      const insertStmt = db.prepare(`
        INSERT INTO appointments (
          title, patient_id, appointment_date, appointment_time, duration, notes, status, appointment_type_id,
          synced, google_calendar_event_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      // Se è stato selezionato un tipo di appuntamento, usa il suo nome come titolo
      let finalTitle = title;
      if (appointment_type_id) {
        const appointmentType = db.prepare('SELECT name FROM appointment_types WHERE id = ?').get(appointment_type_id) as { name: string } | undefined;
        if (appointmentType) {
          finalTitle = appointmentType.name;
        }
      }
      
      const result = insertStmt.run(
        finalTitle,
        patient_id,
        appointment_date,
        appointment_time,
        duration,
        notes || null,
        status,
        appointment_type_id || null,
        0, // non sincronizzato con Google Calendar
        null // nessun ID evento Google Calendar associato
      );
      
      const appointmentId = result.lastInsertRowid;
      
      // If notification requested, create notification
      if (send_notification) {
        // Get notification template
        const template = db.prepare(`
          SELECT * FROM notification_templates 
          WHERE type = 'appointment_created' AND is_system = 1
          LIMIT 1
        `).get() as NotificationTemplate;
        
        if (template) {
          // Get patient details
          const patient = db.prepare(`
            SELECT first_name, last_name FROM users 
            WHERE id = ?
          `).get(patient_id) as Patient;
          
          // Replace placeholders in template
          let message = template.content
            .replace('{first_name}', patient.first_name)
            .replace('{last_name}', patient.last_name)
            .replace('{appointment_date}', appointment_date)
            .replace('{appointment_time}', appointment_time);
          
          // Insert notification
          db.prepare(`
            INSERT INTO notifications (
              user_id, message, status, template_id, appointment_id
            ) VALUES (?, ?, 'pending', ?, ?)
          `).run(
            patient_id,
            message,
            template.id,
            appointmentId
          );
        }
      }
      
      // Commit transaction
      db.prepare('COMMIT').run();
      
      // Get the created appointment
      const newAppointment = db.prepare(`
        SELECT a.*, u.first_name || ' ' || u.last_name as patient_name, u.first_name, u.last_name,
               t.name as appointment_type_name, t.id as appointment_type_id
        FROM appointments a
        JOIN users u ON a.patient_id = u.id
        LEFT JOIN appointment_types t ON a.appointment_type_id = t.id
        WHERE a.id = ?
      `).get(appointmentId);
      
      return res.status(201).json(newAppointment);
    } catch (error) {
      // Rollback transaction in case of error
      db.prepare('ROLLBACK').run();
      throw error;
    }
  } catch (error: any) {
    console.error('Error creating appointment:', error);
    return res.status(500).json({ 
      message: 'Error creating appointment', 
      error: error.message 
    });
  }
};



// Update appointment
// Get appointments by patient ID
export const getAppointmentsByPatientId = async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    
    // Validate patientId is a number
    if (isNaN(Number(patientId))) {
      return res.status(400).json({ message: 'Invalid patient ID' });
    }
    
    const db = getDatabase();
    
    const appointments = db.prepare(`
      SELECT a.*, u.first_name || ' ' || u.last_name as patient_name, u.first_name, u.last_name,
             t.name as appointment_type_name, t.id as appointment_type_id
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      LEFT JOIN appointment_types t ON a.appointment_type_id = t.id
      WHERE a.patient_id = ?
      ORDER BY a.appointment_date, a.appointment_time
    `).all(patientId);
    
    return res.json({ appointments });
  } catch (error: any) {
    console.error('Error getting patient appointments:', error);
    return res.status(500).json({ 
      message: 'Error retrieving patient appointments', 
      error: error.message 
    });
  }
};



// Get appointments by date range
export const getAppointmentsByDateRange = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.params;
    const db = getDatabase();
    
    const appointments = db.prepare(`
      SELECT a.*, u.first_name || ' ' || u.last_name as patient_name, u.first_name, u.last_name
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      WHERE a.appointment_date BETWEEN ? AND ?
      ORDER BY a.appointment_date, a.appointment_time
    `).all(startDate, endDate);
    
    return res.json(appointments);
  } catch (error: any) {
    console.error('Error getting appointments by date range:', error);
    return res.status(500).json({ 
      message: 'Error retrieving appointments by date range', 
      error: error.message 
    });
  }
};



// Get today's appointments
export const getTodayAppointments = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    
    const db = getDatabase();
    const appointments = db.prepare(`
      SELECT a.*, u.first_name || ' ' || u.last_name as patient_name, u.first_name, u.last_name
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      WHERE a.appointment_date = ?
      ORDER BY a.appointment_time
    `).all(formattedDate);
    
    return res.json({ appointments: appointments || [] });
  } catch (error: any) {
    console.error('Error getting today\'s appointments:', error);
    return res.status(500).json({ 
      message: 'Error retrieving today\'s appointments', 
      error: error.message 
    });
  }
};



// Get upcoming appointments
export const getUpcomingAppointments = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    
    const db = getDatabase();
    const appointments = db.prepare(`
      SELECT a.*, u.first_name || ' ' || u.last_name as patient_name, u.first_name, u.last_name
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      WHERE a.appointment_date > ? AND a.status = 'scheduled'
      ORDER BY a.appointment_date, a.appointment_time
      LIMIT 10
    `).all(formattedDate);
    
    return res.json(appointments);
  } catch (error: any) {
    console.error('Error getting upcoming appointments:', error);
    return res.status(500).json({ 
      message: 'Error retrieving upcoming appointments', 
      error: error.message 
    });
  }
};



// Delete appointment
export const deleteAppointment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    // Check if appointment exists
    const appointment = db.prepare(`
      SELECT a.*, u.first_name || ' ' || u.last_name as patient_name, u.first_name, u.last_name,
             t.name as appointment_type_name, t.id as appointment_type_id
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      LEFT JOIN appointment_types t ON a.appointment_type_id = t.id
      WHERE a.id = ?
    `).get(id) as Appointment | undefined;
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    // Se l'appuntamento ha un ID evento Google Calendar, elimina l'evento
    if (appointment.google_calendar_event_id) {
      try {
        const googleCalendarService = new GoogleCalendarService();
        await googleCalendarService.deleteCalendarEvent(appointment.google_calendar_event_id);
      } catch (error) {
        console.error('Errore durante l\'eliminazione dell\'evento da Google Calendar:', error);
        // Continua comunque con l'eliminazione dell'appuntamento
      }
    }
    
    // Delete appointment
    db.prepare('DELETE FROM appointments WHERE id = ?').run(id);
    
    return res.json(appointment);
  } catch (error: any) {
    console.error('Error deleting appointment:', error);
    return res.status(500).json({ 
      message: 'Error deleting appointment', 
      error: error.message 
    });
  }
};



export const updateAppointment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      title,
      appointment_type_id: receivedTypeId,
      patient_id, 
      appointment_date, 
      appointment_time, 
      duration, 
      notes, 
      status,
      send_notification = false
    } = req.body;
    
    // Validate required fields
    if (!patient_id || !appointment_date || !appointment_time || !duration) {
      return res.status(400).json({ 
        message: 'Patient ID, appointment date, time and duration are required' 
      });
    }
    
    // Gestione del tipo di appuntamento
    // Usa direttamente il valore ricevuto dal frontend, anche se è null
    let appointment_type_id = receivedTypeId;
    
    // Solo se non è stato fornito un ID del tipo di appuntamento ma c'è un titolo,
    // prova a recuperare il tipo di appuntamento dal titolo
    if (appointment_type_id === undefined && title) {
      const appointmentType = getAppointmentTypeByName(title);
      if (appointmentType) {
        appointment_type_id = appointmentType.id;
      }
    }
    
    const db = getDatabase();
    
    // Check if appointment exists
    const appointmentExists = db.prepare('SELECT id FROM appointments WHERE id = ?').get(id);
    if (!appointmentExists) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    // Check if patient exists
    const patientExists = db.prepare('SELECT id FROM users WHERE id = ?').get(patient_id);
    if (!patientExists) {
      return res.status(400).json({ message: 'Patient not found' });
    }
    
    // Begin transaction
    db.prepare('BEGIN TRANSACTION').run();
    
    try {
      // Update appointment
      const updateStmt = db.prepare(`
        UPDATE appointments SET
          title = ?,
          patient_id = ?,
          appointment_date = ?,
          appointment_time = ?,
          duration = ?,
          notes = ?,
          status = ?,
          appointment_type_id = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `);
      
      // Se è stato selezionato un tipo di appuntamento, usa il suo nome come titolo
      let finalTitle = title;
      if (appointment_type_id) {
        const appointmentType = db.prepare('SELECT name FROM appointment_types WHERE id = ?').get(appointment_type_id) as { name: string } | undefined;
        if (appointmentType) {
          finalTitle = appointmentType.name;
        }
      }
      
      updateStmt.run(
        finalTitle,
        patient_id,
        appointment_date,
        appointment_time,
        duration,
        notes || null,
        status,
        appointment_type_id || null,
        id
      );
      
      // If notification requested, create notification
      if (send_notification) {
        // Get notification template
        const template = db.prepare(`
          SELECT * FROM notification_templates 
          WHERE type = 'appointment_update' AND is_system = 1
          LIMIT 1
        `).get() as NotificationTemplate;
        
        if (template) {
          // Get patient details
          const patient = db.prepare(`
            SELECT first_name, last_name FROM users 
            WHERE id = ?
          `).get(patient_id) as Patient;
          
          // Replace placeholders in template
          let message = template.content
            .replace('{first_name}', patient.first_name)
            .replace('{last_name}', patient.last_name)
            .replace('{appointment_date}', appointment_date)
            .replace('{appointment_time}', appointment_time);
          
          // Insert notification
          db.prepare(`
            INSERT INTO notifications (
              user_id, message, status, template_id, appointment_id
            ) VALUES (?, ?, 'pending', ?, ?)
          `).run(
            patient_id,
            message,
            template.id,
            id
          );
        }
      }
      
      // Commit transaction
      db.prepare('COMMIT').run();
      
      // Get the updated appointment
      const updatedAppointment = db.prepare(`
        SELECT a.*, u.first_name || ' ' || u.last_name as patient_name, u.first_name, u.last_name,
               t.name as appointment_type_name, t.id as appointment_type_id
        FROM appointments a
        JOIN users u ON a.patient_id = u.id
        LEFT JOIN appointment_types t ON a.appointment_type_id = t.id
        WHERE a.id = ?
      `).get(id);
      
      return res.json(updatedAppointment);
    } catch (error) {
      // Rollback transaction in case of error
      db.prepare('ROLLBACK').run();
      throw error;
    }
  } catch (error: any) {
    console.error('Error updating appointment:', error);
    return res.status(500).json({ 
      message: 'Error updating appointment', 
      error: error.message 
    });
  }
};