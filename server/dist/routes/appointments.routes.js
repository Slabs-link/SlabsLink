"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const appointments_sqlite_controller_1 = require("../controllers/appointments-sqlite.controller");
const router = (0, express_1.Router)();
// GET /api/appointments
router.get('/', appointments_sqlite_controller_1.getAllAppointments);
// GET /api/appointments/stats
router.get('/stats', appointments_sqlite_controller_1.getAppointmentsStats);
// GET /api/appointments/patient/:patientId
router.get('/patient/:patientId', appointments_sqlite_controller_1.getAppointmentsByPatientId);
// GET /api/appointments/range/:startDate/:endDate
router.get('/range/:startDate/:endDate', appointments_sqlite_controller_1.getAppointmentsByDateRange);
// GET /api/appointments/today
router.get('/today', appointments_sqlite_controller_1.getTodayAppointments);
// GET /api/appointments/upcoming
router.get('/upcoming', appointments_sqlite_controller_1.getUpcomingAppointments);
// GET /api/appointments/:id
router.get('/:id', appointments_sqlite_controller_1.getAppointmentById); // Corretto da getAppointmentsById
// POST /api/appointments
router.post('/', appointments_sqlite_controller_1.createAppointment); // Corretto da createAppointments
// PUT /api/appointments/:id
router.put('/:id', appointments_sqlite_controller_1.updateAppointment);
// DELETE /api/appointments/:id
router.delete('/:id', appointments_sqlite_controller_1.deleteAppointment);
exports.default = router;
