import express from 'express';
import setupRoutes from './setup.routes';
import usersRoutes from './users.routes';
import comuniRoutes from './comuni.routes';
import templatesRoutes from './templates.routes';
import notificationsRoutes from './notifications.routes';
import licenseRoutes from './license.routes';
import appointmentTypesRoutes from './appointment-types.routes';
import appointmentsRoutes from './appointments.routes';
import settingsRoutes from './settings.routes';
import googleCalendarRoutes from './google-calendar.routes';

const router = express.Router();

// Setup routes
router.use('/setup', setupRoutes);
// Aggiungiamo un endpoint di test anche qui
router.get('/routes-test', (req, res) => {
    res.json({ message: 'Routes are loaded correctly' });
  });
// Register routes
router.use('/users', usersRoutes);
router.use('/templates', templatesRoutes);
router.use('/notifications', notificationsRoutes);

// Comuni routes
router.use('/comuni', comuniRoutes);
// Appointment routes
router.use('/appointment-types', appointmentTypesRoutes);
router.use('/appointments', appointmentsRoutes);
// Settings routes
router.use('/settings', settingsRoutes);
router.use('/license', licenseRoutes);
// Google Calendar routes
router.use('/google-calendar', googleCalendarRoutes);
// Log delle route registrate
console.log('Routes registered:');
console.log('- /api/routes-test');
console.log('- /api/users/...');
console.log('- /api/templates/...');
console.log('- /api/notifications/...');
console.log('- /api/google-calendar/...');

export default router;