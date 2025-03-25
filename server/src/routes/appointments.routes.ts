import { Router } from 'express';
import {
  getAllAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getAppointmentsByPatientId,
  getAppointmentsByDateRange,
  getTodayAppointments,
  getUpcomingAppointments,
  getAppointmentsStats,
  syncAppointmentsWithGoogleCalendar
} from '../controllers/appointments-sqlite.controller';

const router = Router();

// GET /api/appointments
router.get('/', getAllAppointments);

// GET /api/appointments/stats
router.get('/stats', getAppointmentsStats);

// GET /api/appointments/patient/:patientId
router.get('/patient/:patientId', getAppointmentsByPatientId);

// GET /api/appointments/range/:startDate/:endDate
router.get('/range/:startDate/:endDate', getAppointmentsByDateRange);

// GET /api/appointments/today
router.get('/today', getTodayAppointments);

// GET /api/appointments/upcoming
router.get('/upcoming', getUpcomingAppointments);

// GET /api/appointments/:id
router.get('/:id', getAppointmentById); // Corretto da getAppointmentsById

// POST /api/appointments
router.post('/', createAppointment); // Corretto da createAppointments

// PUT /api/appointments/:id
router.put('/:id', updateAppointment);

// DELETE /api/appointments/:id
router.delete('/:id', deleteAppointment);

// POST /api/appointments/sync-google-calendar
router.post('/sync-google-calendar', syncAppointmentsWithGoogleCalendar);

export default router;