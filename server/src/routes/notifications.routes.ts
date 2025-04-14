import { Router } from 'express';
import {
  getAllNotifications,
  createNotification,
  processNotifications,
  processSingleNotification,
  getNotificationById,
  updateNotification,
  deleteNotification,
  createNotificationFromTemplate,
  createAppointmentNotification,
  resendNotification
} from '../controllers/notifications-sqlite.controller';

const router = Router();

// GET /api/notifications
router.get('/', getAllNotifications);

// POST /api/notifications
router.post('/', createNotification);

// POST /api/notifications/process
router.post('/process', processNotifications);

// POST /api/notifications/process/:id
router.post('/process/:id', processSingleNotification);

// POST /api/notifications/template - Create a notification from template
router.post('/template', createNotificationFromTemplate);

// POST /api/notifications/appointment - Create a notification for an appointment
router.post('/appointment', createAppointmentNotification);

// Rotte con parametri dinamici devono essere definite dopo le rotte statiche
// GET /api/notifications/:id
router.get('/:id', getNotificationById);

// PUT /api/notifications/:id
router.put('/:id', updateNotification);

// DELETE /api/notifications/:id
router.delete('/:id', deleteNotification);

// POST /api/notifications/:id/resend - Resend a notification
router.post('/:id/resend', resendNotification);

export default router;