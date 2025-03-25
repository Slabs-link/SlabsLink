"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAppointment = exports.deleteAppointment = exports.getUpcomingAppointments = exports.getTodayAppointments = exports.getAppointmentsByDateRange = exports.getAppointmentsByPatientId = exports.createAppointment = exports.getAppointmentById = exports.getAllAppointments = exports.getAppointmentsStats = void 0;
const database_sqlite_1 = require("../config/database-sqlite");
// Get appointments statistics
const getAppointmentsStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const db = (0, database_sqlite_1.getDatabase)();
        const stats = db.prepare(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        COUNT(*) as total
      FROM appointments
    `).get();
        return res.json({
            completed: stats.completed || 0,
            cancelled: stats.cancelled || 0,
            total: stats.total || 0
        });
    }
    catch (error) {
        console.error('Error getting appointments stats:', error);
        return res.status(500).json({
            message: 'Error retrieving appointments statistics',
            error: error.message
        });
    }
});
exports.getAppointmentsStats = getAppointmentsStats;
// Get all appointments
const getAllAppointments = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const db = (0, database_sqlite_1.getDatabase)();
        const appointments = db.prepare(`
      SELECT a.*, u.first_name || ' ' || u.last_name as patient_name, u.first_name, u.last_name
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      ORDER BY a.appointment_date DESC, a.appointment_time ASC
    `).all();
        return res.json(appointments);
    }
    catch (error) {
        console.error('Error getting appointments:', error);
        return res.status(500).json({
            message: 'Error retrieving appointments',
            error: error.message
        });
    }
});
exports.getAllAppointments = getAllAppointments;
// Get appointment by ID
const getAppointmentById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const db = (0, database_sqlite_1.getDatabase)();
        const appointment = db.prepare(`
      SELECT a.*, u.first_name || ' ' || u.last_name as patient_name, u.first_name, u.last_name
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      WHERE a.id = ?
    `).get(id);
        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }
        return res.json(appointment);
    }
    catch (error) {
        console.error('Error getting appointment:', error);
        return res.status(500).json({
            message: 'Error retrieving appointment',
            error: error.message
        });
    }
});
exports.getAppointmentById = getAppointmentById;
// Create new appointment
const createAppointment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { patient_id, appointment_date, appointment_time, duration, notes, status = 'scheduled', send_notification = false } = req.body;
        // Validate required fields
        if (!patient_id || !appointment_date || !appointment_time || !duration) {
            return res.status(400).json({
                message: 'Patient ID, appointment date, time and duration are required'
            });
        }
        const db = (0, database_sqlite_1.getDatabase)();
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
          patient_id, appointment_date, appointment_time, duration, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);
            const result = insertStmt.run(patient_id, appointment_date, appointment_time, duration, notes || null, status);
            const appointmentId = result.lastInsertRowid;
            // If notification requested, create notification
            if (send_notification) {
                // Get notification template
                const template = db.prepare(`
          SELECT * FROM notification_templates 
          WHERE type = 'appointment_created' AND is_system = 1
          LIMIT 1
        `).get();
                if (template) {
                    // Get patient details
                    const patient = db.prepare(`
            SELECT first_name, last_name FROM users 
            WHERE id = ?
          `).get(patient_id);
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
          `).run(patient_id, message, template.id, appointmentId);
                }
            }
            // Commit transaction
            db.prepare('COMMIT').run();
            // Get the created appointment
            const newAppointment = db.prepare(`
        SELECT a.*, u.first_name || ' ' || u.last_name as patient_name, u.first_name, u.last_name
        FROM appointments a
        JOIN users u ON a.patient_id = u.id
        WHERE a.id = ?
      `).get(appointmentId);
            return res.status(201).json(newAppointment);
        }
        catch (error) {
            // Rollback transaction in case of error
            db.prepare('ROLLBACK').run();
            throw error;
        }
    }
    catch (error) {
        console.error('Error creating appointment:', error);
        return res.status(500).json({
            message: 'Error creating appointment',
            error: error.message
        });
    }
});
exports.createAppointment = createAppointment;
// Update appointment
// Get appointments by patient ID
const getAppointmentsByPatientId = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { patientId } = req.params;
        const db = (0, database_sqlite_1.getDatabase)();
        const appointments = db.prepare(`
      SELECT a.*, u.first_name || ' ' || u.last_name as patient_name, u.first_name, u.last_name
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      WHERE a.patient_id = ?
      ORDER BY a.appointment_date, a.appointment_time
    `).all(patientId);
        return res.json(appointments);
    }
    catch (error) {
        console.error('Error getting patient appointments:', error);
        return res.status(500).json({
            message: 'Error retrieving patient appointments',
            error: error.message
        });
    }
});
exports.getAppointmentsByPatientId = getAppointmentsByPatientId;
// Get appointments by date range
const getAppointmentsByDateRange = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { startDate, endDate } = req.params;
        const db = (0, database_sqlite_1.getDatabase)();
        const appointments = db.prepare(`
      SELECT a.*, u.first_name || ' ' || u.last_name as patient_name, u.first_name, u.last_name
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      WHERE a.appointment_date BETWEEN ? AND ?
      ORDER BY a.appointment_date, a.appointment_time
    `).all(startDate, endDate);
        return res.json(appointments);
    }
    catch (error) {
        console.error('Error getting appointments by date range:', error);
        return res.status(500).json({
            message: 'Error retrieving appointments by date range',
            error: error.message
        });
    }
});
exports.getAppointmentsByDateRange = getAppointmentsByDateRange;
// Get today's appointments
const getTodayAppointments = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
        const db = (0, database_sqlite_1.getDatabase)();
        const appointments = db.prepare(`
      SELECT a.*, u.first_name || ' ' || u.last_name as patient_name, u.first_name, u.last_name
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      WHERE a.appointment_date = ?
      ORDER BY a.appointment_time
    `).all(formattedDate);
        return res.json(appointments);
    }
    catch (error) {
        console.error('Error getting today\'s appointments:', error);
        return res.status(500).json({
            message: 'Error retrieving today\'s appointments',
            error: error.message
        });
    }
});
exports.getTodayAppointments = getTodayAppointments;
// Get upcoming appointments
const getUpcomingAppointments = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
        const db = (0, database_sqlite_1.getDatabase)();
        const appointments = db.prepare(`
      SELECT a.*, u.first_name || ' ' || u.last_name as patient_name, u.first_name, u.last_name
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      WHERE a.appointment_date > ? AND a.status = 'scheduled'
      ORDER BY a.appointment_date, a.appointment_time
      LIMIT 10
    `).all(formattedDate);
        return res.json(appointments);
    }
    catch (error) {
        console.error('Error getting upcoming appointments:', error);
        return res.status(500).json({
            message: 'Error retrieving upcoming appointments',
            error: error.message
        });
    }
});
exports.getUpcomingAppointments = getUpcomingAppointments;
// Delete appointment
const deleteAppointment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const db = (0, database_sqlite_1.getDatabase)();
        // Check if appointment exists
        const appointment = db.prepare(`
      SELECT a.*, u.first_name || ' ' || u.last_name as patient_name, u.first_name, u.last_name
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      WHERE a.id = ?
    `).get(id);
        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }
        // Delete appointment
        db.prepare('DELETE FROM appointments WHERE id = ?').run(id);
        return res.json(appointment);
    }
    catch (error) {
        console.error('Error deleting appointment:', error);
        return res.status(500).json({
            message: 'Error deleting appointment',
            error: error.message
        });
    }
});
exports.deleteAppointment = deleteAppointment;
const updateAppointment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { patient_id, appointment_date, appointment_time, duration, notes, status, send_notification = false } = req.body;
        // Validate required fields
        if (!patient_id || !appointment_date || !appointment_time || !duration) {
            return res.status(400).json({
                message: 'Patient ID, appointment date, time and duration are required'
            });
        }
        const db = (0, database_sqlite_1.getDatabase)();
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
          patient_id = ?,
          appointment_date = ?,
          appointment_time = ?,
          duration = ?,
          notes = ?,
          status = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `);
            updateStmt.run(patient_id, appointment_date, appointment_time, duration, notes || null, status, id);
            // If notification requested, create notification
            if (send_notification) {
                // Get notification template
                const template = db.prepare(`
          SELECT * FROM notification_templates 
          WHERE type = 'appointment_update' AND is_system = 1
          LIMIT 1
        `).get();
                if (template) {
                    // Get patient details
                    const patient = db.prepare(`
            SELECT first_name, last_name FROM users 
            WHERE id = ?
          `).get(patient_id);
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
          `).run(patient_id, message, template.id, id);
                }
            }
            // Commit transaction
            db.prepare('COMMIT').run();
            // Get the updated appointment
            const updatedAppointment = db.prepare(`
        SELECT a.*, u.first_name || ' ' || u.last_name as patient_name, u.first_name, u.last_name
        FROM appointments a
        JOIN users u ON a.patient_id = u.id
        WHERE a.id = ?
      `).get(id);
            return res.json(updatedAppointment);
        }
        catch (error) {
            // Rollback transaction in case of error
            db.prepare('ROLLBACK').run();
            throw error;
        }
    }
    catch (error) {
        console.error('Error updating appointment:', error);
        return res.status(500).json({
            message: 'Error updating appointment',
            error: error.message
        });
    }
});
exports.updateAppointment = updateAppointment;
