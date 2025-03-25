import express from 'express';
import { AppointmentModel } from '../models/appointment';
import { getDb } from '../src/db/db-sqlite';

const router = express.Router();

// Get all appointments
router.get('/', async (req, res) => {
  try {
    const appointments = await AppointmentModel.findAll();
    res.json(appointments);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Get appointments by patient ID
router.get('/patient/:patientId', async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const appointments = await AppointmentModel.findByPatientId(patientId);
    res.json(appointments);
  } catch (error) {
    console.error('Error fetching patient appointments:', error);
    res.status(500).json({ error: 'Failed to fetch patient appointments' });
  }
});

// Get appointments by date range
router.get('/range/:startDate/:endDate', async (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    const appointments = await AppointmentModel.findByDateRange(startDate, endDate);
    res.json(appointments);
  } catch (error) {
    console.error('Error fetching appointments by date range:', error);
    res.status(500).json({ error: 'Failed to fetch appointments by date range' });
  }
});

// Get today's appointments
router.get('/today', async (req, res) => {
  try {
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    
    const query = `
      SELECT a.*, (u.first_name || ' ' || u.last_name) as patient_name, u.first_name, u.last_name
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      WHERE a.appointment_date = ?
      ORDER BY a.appointment_time
    `;

    
    const db = getDb();
    const result = db.prepare(query).all(formattedDate);
    res.json(result);
  } catch (error) {
    console.error('Error fetching today\'s appointments:', error);
    res.status(500).json({ error: 'Failed to fetch today\'s appointments' });
  }
});

// Get upcoming appointments
router.get('/upcoming', async (req, res) => {
  try {
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    
    const query = `
      SELECT a.*, (u.first_name || ' ' || u.last_name) as patient_name, u.first_name, u.last_name
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      WHERE a.appointment_date > ? AND a.status = 'scheduled'
      ORDER BY a.appointment_date, a.appointment_time
      LIMIT 10
    `;
    
    const db = getDb();
    const result = db.prepare(query).all(formattedDate);
    res.json(result);
  } catch (error) {
    console.error('Error fetching upcoming appointments:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming appointments' });
  }
});

// Get appointment statistics
router.get('/stats', async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
        COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled
      FROM appointments
    `;
    
    const db = getDb();
    const result = db.prepare(query).get();
    res.json(result);
  } catch (error) {
    console.error('Error fetching appointment statistics:', error);
    res.status(500).json({ error: 'Failed to fetch appointment statistics' });
  }
});

// Get appointment by ID
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const appointment = await AppointmentModel.findById(id);
    
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    res.json(appointment);
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// Create new appointment
router.post('/', async (req, res) => {
  try {
    const appointment = req.body;
    const newAppointment = await AppointmentModel.create(appointment);
    res.status(201).json(newAppointment);
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// Update appointment
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const appointment = req.body;
    const updatedAppointment = await AppointmentModel.update(id, appointment);
    
    if (!updatedAppointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    res.json(updatedAppointment);
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Delete appointment
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deletedAppointment = await AppointmentModel.delete(id);
    
    if (!deletedAppointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    res.json(deletedAppointment);
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

export default router;