import { Router } from 'express';
import {
  getAllNotifications,
  createNotification,
  processNotifications,
  processSingleNotification,
  getNotificationById,
  updateNotification,
  deleteNotification,
  createNotificationFromTemplate
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

// GET /api/notifications/:id
router.get('/:id', getNotificationById);

// PUT /api/notifications/:id
router.put('/:id', updateNotification);

// DELETE /api/notifications/:id
router.delete('/:id', deleteNotification);

// POST /api/notifications/template - Create a notification from template
router.post('/template', createNotificationFromTemplate);

export default router;