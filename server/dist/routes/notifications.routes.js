"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notifications_sqlite_controller_1 = require("../controllers/notifications-sqlite.controller");
const router = (0, express_1.Router)();
// GET /api/notifications
router.get('/', notifications_sqlite_controller_1.getAllNotifications);
// POST /api/notifications
router.post('/', notifications_sqlite_controller_1.createNotification);
// POST /api/notifications/process
router.post('/process', notifications_sqlite_controller_1.processNotifications);
// POST /api/notifications/process/:id
router.post('/process/:id', notifications_sqlite_controller_1.processSingleNotification);
// GET /api/notifications/:id
router.get('/:id', notifications_sqlite_controller_1.getNotificationById);
// PUT /api/notifications/:id
router.put('/:id', notifications_sqlite_controller_1.updateNotification);
// DELETE /api/notifications/:id
router.delete('/:id', notifications_sqlite_controller_1.deleteNotification);
// POST /api/notifications/template - Create a notification from template
router.post('/template', notifications_sqlite_controller_1.createNotificationFromTemplate);
exports.default = router;
