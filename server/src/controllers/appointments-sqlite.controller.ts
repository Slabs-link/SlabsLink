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
  duration: number;
  notes?: string;
  status: string;
  created_at?: string;
  user_id?: number;
  first_name?: string;
  last_name?: string;
  patient_name: string;
  synced?: number;
  google_calendar_event_id?: string | null;
  appointment_type_id?: number | null;
  appointment_type_name?: string;
  start_time: string;
  end_time: string;
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
      ORDER BY a.date DESC
    `).all();
    
    // Formatta le date prima di inviarle al frontend
    const formattedAppointments = appointments.map((appointment: any) => {
      // Assicurati che i campi appointment_date e appointment_time siano presenti
      // e che siano in un formato semplice senza timezone
      if (appointment && 'date' in appointment && appointment.date) {
        appointment.appointment_date = appointment.date.split('T')[0]; // Estrai solo la parte della data YYYY-MM-DD
      }
      if (appointment && 'time' in appointment && appointment.time) {
        appointment.appointment_time = appointment.time.split('T')[1]?.substring(0, 5) || appointment.time; // Estrai HH:MM
      }
      return appointment;
    });
    
    return res.json(formattedAppointments);
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
    `).get(id) as Appointment | undefined;
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    // Formatta le date prima di inviarle al frontend
    if (appointment && typeof appointment === 'object' && 'date' in appointment && appointment.date) {
      (appointment as any).appointment_date = appointment.date.split('T')[0]; // Estrai solo la parte della data YYYY-MM-DD
    }
    if (appointment && typeof appointment === 'object' && 'time' in appointment && appointment.time) {
      (appointment as any).appointment_time = appointment.time.split('T')[1]?.substring(0, 5) || appointment.time; // Estrai HH:MM
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
      date, 
      time, 
      duration, 
      notes, 
      status = 'scheduled',
      send_notification = false
    } = req.body;
    
    // Calcola start_time e end_time
    const start_time = new Date(`${date}T${time}`).toISOString();
    const end_time = new Date(new Date(start_time).getTime() + duration * 60000).toISOString();
    
    // Validate required fields
    if (!patient_id || !date || !time || !duration) {
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
      // Calcola le date di inizio e fine per Google Calendar
      const [year, month, day] = date.split('-').map(Number);
      const [hours, minutes] = time.split(':').map(Number);
      
      // Validazione dei valori della data
      if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes) ||
          month < 1 || month > 12 || day < 1 || day > 31 || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return res.status(400).json({ 
          message: 'Invalid date or time format. Please check your input.' 
        });
      }
      
      // Crea la data di inizio (assicurandosi che sia nel fuso orario locale)
      // Nota: in JavaScript i mesi sono 0-based (0 = gennaio, 11 = dicembre)
      const startDate = new Date(year, month - 1, day, hours, minutes);
      
      // Log per debug
      console.log(`Creazione appuntamento - Data ricevuta: ${date}, Ora: ${time}`);
      console.log(`Valori convertiti - Anno: ${year}, Mese: ${month}, Giorno: ${day}, Ore: ${hours}, Minuti: ${minutes}`);
      console.log(`Data di inizio creata: ${startDate.toISOString()}`);
      
      // Verifica che la data sia valida prima di chiamare toISOString()
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({ 
          message: 'Invalid date. Please check your input.' 
        });
      }
      
      const start_time = startDate.toISOString();
      
      // Crea la data di fine aggiungendo la durata
      const endDate = new Date(startDate.getTime() + duration * 60 * 1000);
      
      // Verifica che la data di fine sia valida
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({ 
          message: 'Invalid duration. Please check your input.' 
        });
      }
      
      const end_time = endDate.toISOString();
      
      // Insert appointment
      const insertStmt = db.prepare(`
        INSERT INTO appointments (
          title, patient_id, date, time, duration, notes, status, appointment_type_id,
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
        date,
        time,
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
            .replace('{date}', date)
            .replace('{time}', time);
          
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
      
      // Sincronizza automaticamente con Google Calendar se abilitato
      try {
        // Calcola start_time e end_time per Google Calendar
        const startDate = new Date(`${date}T${time}`);
        const endDate = new Date(startDate.getTime() + duration * 60 * 1000);
        
        // Avvia la sincronizzazione in background
        syncAppointmentWithGoogleCalendar(
          Number(appointmentId),
          notes || '',
          startDate.toISOString(),
          endDate.toISOString(),
          newAppointment
        ).catch(error => {
          console.error('Error in background Google Calendar sync:', error);
        });
      } catch (syncError) {
        console.error('Error preparing Google Calendar sync:', syncError);
        // Non blocchiamo la risposta in caso di errore nella sincronizzazione
      }
      
      return res.status(201).json(newAppointment);
    } catch (error: any) {
      // Rollback transaction on error
      db.prepare('ROLLBACK').run();
      console.error('Error creating appointment:', error);
      return res.status(500).json({ 
        message: 'Error creating appointment', 
        error: error.message 
      });
    }
  } catch (error: any) {
    console.error('Error in createAppointment:', error);
    return res.status(500).json({ 
      message: 'Error creating appointment', 
      error: error.message 
    });
  }
}

// Async function to handle Google Calendar sync
export const syncAppointmentWithGoogleCalendar = async (appointmentId: number, notes: string, start_time: string, end_time: string, appointmentData: any) => {
  const db = getDatabase();
  
  try {
    const calendarService = new GoogleCalendarService();
    if (await calendarService.isServiceEnabled() && await calendarService.isServiceAuthenticated()) {
      await calendarService.configure();
      
      console.log(`Tentativo di sincronizzazione con Google Calendar per l'appuntamento ID: ${appointmentId}`);
      console.log(`Start time: ${start_time}, End time: ${end_time}`);
      
      // Ottieni i dati completi dell'appuntamento se non sono già disponibili
      let appointmentDetails = appointmentData;
      if (!appointmentData.first_name || !appointmentData.last_name || !appointmentData.patient_name) {
        appointmentDetails = db.prepare(`
          SELECT a.*, u.first_name, u.last_name, u.first_name || ' ' || u.last_name as patient_name, a.title
          FROM appointments a
          JOIN users u ON a.patient_id = u.id
          WHERE a.id = ?
        `).get(appointmentId);
      }
      
      // Assicurati che il titolo dell'appuntamento sia disponibile
      const title = appointmentDetails.title || appointmentDetails.appointment_type_name || 'Appuntamento';
      
      // Assicurati che il nome del paziente sia disponibile
      const patientName = appointmentDetails.patient_name || 
                         (appointmentDetails.first_name && appointmentDetails.last_name ? 
                          `${appointmentDetails.first_name} ${appointmentDetails.last_name}` : 
                          'Paziente');
      
      // Prepara l'appuntamento per la sincronizzazione
      const appointmentForSync = {
        id: Number(appointmentId),
        title: title,
        patient_name: patientName,
        start_time,
        end_time,
        notes: notes || '',
        google_calendar_event_id: appointmentDetails.google_calendar_event_id || null
      };
      
      console.log('Dati per la sincronizzazione:', {
        id: appointmentForSync.id,
        title: appointmentForSync.title,
        patient_name: appointmentForSync.patient_name
      });
      
      // Sincronizza con Google Calendar
      const syncResult = await calendarService.syncAppointment(appointmentForSync);
      console.log(`Sincronizzazione completata con successo. Event ID: ${syncResult?.id || 'N/A'}`);
      
      // Aggiorna il record dell'appuntamento con l'ID dell'evento di Google Calendar
      if (syncResult && syncResult.id) {
        db.prepare(`
          UPDATE appointments 
          SET google_calendar_event_id = ?, synced = 1 
          WHERE id = ?
        `).run(syncResult.id, appointmentId);
      }
    } else {
      console.log('Servizio Google Calendar non configurato o non autenticato. Sincronizzazione saltata.');
    }
  } catch (syncError) {
    console.error('Error syncing appointment with Google Calendar:', syncError);
    // Aggiorniamo il record con l'errore di sincronizzazione
    try {
      db.prepare(`
        UPDATE appointments 
        SET sync_error = ? 
        WHERE id = ?
      `).run(
        (syncError instanceof Error ? syncError.message : 'Unknown error during sync'),
        appointmentId
      );
    } catch (updateError) {
      console.error('Error updating appointment with sync error:', updateError);
    }
  }
}

// Update appointment
// Get appointments by patient ID
export const getAppointmentsByPatientId = async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    let pId = patientId + '.0';
    console.log('getAppointmentsByPatientId called with patientId:', patientId);
    
    // Validate patientId is a number
    if (isNaN(Number(patientId))) {
      return res.status(400).json({ message: 'Invalid patient ID' });
    }
    
    const db = getDatabase();
    
    const appointments = db.prepare(`
      SELECT a.*, u.first_name || ' ' || u.last_name as patient_name, u.first_name, u.last_name,
             t.name as appointment_type_name, t.id as appointment_type_id
      FROM appointments a
      JOIN users u ON a.patient_id = u.id OR a.patient_id = CAST(u.id AS TEXT)
      LEFT JOIN appointment_types t ON a.appointment_type_id = t.id
      WHERE a.patient_id = ? OR a.patient_id = CAST(? AS TEXT)
      ORDER BY a.date, a.time
    `).all(pId, pId);
    
    // Formatta le date prima di inviarle al frontend
    const formattedAppointments = appointments.map((appointment: any) => {
      if (appointment && appointment.date) {
        appointment.appointment_date = appointment.date.split('T')[0];
      }
      if (appointment && appointment.time) {
        appointment.appointment_time = appointment.time.split('T')[1]?.substring(0, 5) || appointment.time;
      }
      console.log('appointment:', appointment);
      return appointment;
    });
    
    return res.json({ appointments: formattedAppointments });
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
      WHERE a.date BETWEEN ? AND ?
      ORDER BY a.date, a.time
    `).all(startDate, endDate);
    
    // Formatta le date prima di inviarle al frontend
    const formattedAppointments = appointments.map((appointment: any) => {
      // Assicurati che i campi appointment_date e appointment_time siano presenti
      // e che siano in un formato semplice senza timezone
      if (appointment && 'date' in appointment && appointment.date) {
        appointment.appointment_date = appointment.date.split('T')[0]; // Estrai solo la parte della data YYYY-MM-DD
      }
      if (appointment && 'time' in appointment && appointment.time) {
        appointment.appointment_time = appointment.time.split('T')[1]?.substring(0, 5) || appointment.time; // Estrai HH:MM
      }
      return appointment;
    });
    
    return res.json(formattedAppointments);
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
      WHERE a.date = ?
      ORDER BY a.time
    `).all(formattedDate);
    
    // Formatta le date prima di inviarle al frontend
    const formattedAppointments = (appointments || []).map((appointment: any) => {
      // Assicurati che i campi appointment_date e appointment_time siano presenti
      // e che siano in un formato semplice senza timezone
      if (appointment.appointment_date) {
        appointment.appointment_date = appointment.appointment_date.split('T')[0]; // Estrai solo la parte della data YYYY-MM-DD
      }
      if (appointment.appointment_time) {
        appointment.appointment_time = appointment.appointment_time.split('T')[1]?.substring(0, 5) || appointment.appointment_time; // Estrai HH:MM
      }
      return appointment;
    });
    
    return res.json(formattedAppointments);
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
      WHERE a.date > ? AND a.status = 'scheduled'
      ORDER BY a.date, a.time
      LIMIT 10
    `).all(formattedDate);
    
    // Formatta le date prima di inviarle al frontend
    const formattedAppointments = appointments.map((appointment: any) => {
      // Assicurati che i campi appointment_date e appointment_time siano presenti
      // e che siano in un formato semplice senza timezone
      if (appointment && 'appointment_date' in appointment && appointment.appointment_date) {
        appointment.appointment_date = appointment.appointment_date.split('T')[0]; // Estrai solo la parte della data YYYY-MM-DD
      }
      if (appointment && 'appointment_time' in appointment && appointment.appointment_time) {
        appointment.appointment_time = appointment.appointment_time.split('T')[1]?.substring(0, 5) || appointment.appointment_time; // Estrai HH:MM
      }
      return appointment;
    });
    
    return res.json(formattedAppointments);
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
        
        // Verifica che il servizio sia abilitato e autenticato prima di procedere
        if (await googleCalendarService.isServiceEnabled() && await googleCalendarService.isServiceAuthenticated()) {
          // Configura il servizio prima di utilizzarlo
          await googleCalendarService.configure();
          
          console.log(`Tentativo di eliminazione evento Google Calendar con ID: ${appointment.google_calendar_event_id}`);
          await googleCalendarService.deleteCalendarEvent(appointment.google_calendar_event_id);
          console.log(`Evento Google Calendar eliminato con successo`);
        } else {
          console.warn('Servizio Google Calendar non abilitato o non autenticato, impossibile eliminare l\'evento');
        }
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
      date, 
      time, 
      appointment_date,
      appointment_time,
      duration, 
      notes, 
      status,
      send_notification = false
    } = req.body;
    
    // Usa appointment_date e appointment_time se forniti, altrimenti usa date e time
    const finalDate = appointment_date || date;
    const finalTime = appointment_time || time;
    
    // Validate required fields
    if (!patient_id || !finalDate || !finalTime || !duration) {
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
          date = ?,
          time = ?,
          duration = ?,
          notes = ?,
          status = ?,
          appointment_type_id = ?
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
        finalDate,
        finalTime,
        duration,
        notes || null,
        status,
        appointment_type_id || null,
        id
      );
      
      // Log per debug
      console.log('Appointment updated with data:', {
        id,
        title: finalTitle,
        patient_id,
        date: finalDate,
        time: finalTime,
        duration,
        status,
        appointment_type_id
      });
      
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
            .replace('{date}', finalDate)
            .replace('{time}', finalTime);
          
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
      
      // Sincronizza automaticamente con Google Calendar se abilitato
      try {
        // Calcola start_time e end_time per Google Calendar
        const startDate = new Date(`${finalDate}T${finalTime}`);
        const endDate = new Date(startDate.getTime() + duration * 60 * 1000);
        
        // Avvia la sincronizzazione in background
        syncAppointmentWithGoogleCalendar(
          Number(id),
          notes || '',
          startDate.toISOString(),
          endDate.toISOString(),
          updatedAppointment
        ).catch(error => {
          console.error('Error in background Google Calendar sync during update:', error);
        });
      } catch (syncError) {
        console.error('Error preparing Google Calendar sync during update:', syncError);
        // Non blocchiamo la risposta in caso di errore nella sincronizzazione
      }
      
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
