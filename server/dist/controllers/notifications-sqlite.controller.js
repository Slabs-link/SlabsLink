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
exports.resendNotification = exports.createNotificationFromTemplate = exports.updateNotification = exports.processSingleNotification = exports.processNotifications = exports.getPendingNotifications = exports.deleteNotification = exports.updateNotificationStatus = exports.createNotification = exports.getNotificationById = exports.getAllNotifications = void 0;
const database_sqlite_1 = require("../config/database-sqlite");
// Get all notifications
const getAllNotifications = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const db = (0, database_sqlite_1.getDatabase)();
        const notifications = db.prepare(`
      SELECT n.*, u.first_name, u.last_name
      FROM notifications n
      JOIN users u ON n.user_id = u.id
      ORDER BY n.created_at DESC
    `).all();
        return res.json(notifications);
    }
    catch (error) {
        console.error('Error getting notifications:', error);
        return res.status(500).json({
            message: 'Error retrieving notifications',
            error: error.message
        });
    }
});
exports.getAllNotifications = getAllNotifications;
// Get notification by ID
const getNotificationById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const db = (0, database_sqlite_1.getDatabase)();
        const notification = db.prepare(`
      SELECT n.*, u.first_name, u.last_name
      FROM notifications n
      JOIN users u ON n.user_id = u.id
      WHERE n.id = ?
    `).get(id);
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        return res.json(notification);
    }
    catch (error) {
        console.error('Error getting notification:', error);
        return res.status(500).json({
            message: 'Error retrieving notification',
            error: error.message
        });
    }
});
exports.getNotificationById = getNotificationById;
// Create new notification
const createNotification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { user_id, message, template_id, appointment_id, variables } = req.body;
        // Validate required fields
        if (!user_id) {
            return res.status(400).json({
                message: 'User ID is required'
            });
        }
        if (!message && !template_id) {
            return res.status(400).json({
                message: 'Either message or template_id is required'
            });
        }
        const db = (0, database_sqlite_1.getDatabase)();
        // Check if user exists
        const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id);
        if (!userExists) {
            return res.status(400).json({ message: 'User not found' });
        }
        let finalMessage = message;
        // If template_id is provided, get the template and replace variables
        if (template_id) {
            const template = db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(template_id);
            if (!template) {
                return res.status(400).json({ message: 'Template not found' });
            }
            finalMessage = template.content;
            // Get user details for variable replacement
            const user = db.prepare('SELECT first_name, last_name FROM users WHERE id = ?').get(user_id);
            // Replace user variables
            finalMessage = finalMessage
                .replace('{first_name}', user.first_name)
                .replace('{last_name}', user.last_name);
            // Replace appointment variables if appointment_id is provided
            if (appointment_id) {
                const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointment_id);
                if (appointment) {
                    finalMessage = finalMessage
                        .replace('{appointment_date}', appointment.appointment_date)
                        .replace('{appointment_time}', appointment.appointment_time);
                }
            }
            // Replace custom variables if provided
            if (variables) {
                Object.keys(variables).forEach(key => {
                    finalMessage = finalMessage.replace(`{${key}}`, variables[key]);
                });
            }
        }
        // Insert notification
        const insertStmt = db.prepare(`
      INSERT INTO notifications (
        user_id, message, status, template_id, appointment_id
      ) VALUES (?, ?, 'pending', ?, ?)
    `);
        const result = insertStmt.run(user_id, finalMessage, template_id || null, appointment_id || null);
        const notificationId = result.lastInsertRowid;
        // Get the created notification
        const newNotification = db.prepare(`
      SELECT n.*, u.first_name, u.last_name
      FROM notifications n
      JOIN users u ON n.user_id = u.id
      WHERE n.id = ?
    `).get(notificationId);
        return res.status(201).json(newNotification);
    }
    catch (error) {
        console.error('Error creating notification:', error);
        return res.status(500).json({
            message: 'Error creating notification',
            error: error.message
        });
    }
});
exports.createNotification = createNotification;
// Update notification status
const updateNotificationStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { status, error_message } = req.body;
        // Validate required fields
        if (!status) {
            return res.status(400).json({
                message: 'Status is required'
            });
        }
        const db = (0, database_sqlite_1.getDatabase)();
        // Check if notification exists
        const notificationExists = db.prepare('SELECT id FROM notifications WHERE id = ?').get(id);
        if (!notificationExists) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        // Update notification status
        const updateStmt = db.prepare(`
      UPDATE notifications SET
        status = ?,
        error_message = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `);
        updateStmt.run(status, error_message || null, id);
        // Get the updated notification
        const updatedNotification = db.prepare(`
      SELECT n.*, u.first_name, u.last_name
      FROM notifications n
      JOIN users u ON n.user_id = u.id
      WHERE n.id = ?
    `).get(id);
        return res.json(updatedNotification);
    }
    catch (error) {
        console.error('Error updating notification status:', error);
        return res.status(500).json({
            message: 'Error updating notification status',
            error: error.message
        });
    }
});
exports.updateNotificationStatus = updateNotificationStatus;
// Delete notification
const deleteNotification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const db = (0, database_sqlite_1.getDatabase)();
        // Check if notification exists
        const notificationExists = db.prepare('SELECT id FROM notifications WHERE id = ?').get(id);
        if (!notificationExists) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        // Delete notification
        db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
        return res.json({ message: 'Notification deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting notification:', error);
        return res.status(500).json({
            message: 'Error deleting notification',
            error: error.message
        });
    }
});
exports.deleteNotification = deleteNotification;
// Get pending notifications
const getPendingNotifications = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const db = (0, database_sqlite_1.getDatabase)();
        const notifications = db.prepare(`
      SELECT n.*, u.phone, u.first_name, u.last_name
      FROM notifications n
      JOIN users u ON n.user_id = u.id
      WHERE n.status = 'pending'
      ORDER BY n.created_at ASC
    `).all();
        return res.json(notifications);
    }
    catch (error) {
        console.error('Error getting pending notifications:', error);
        return res.status(500).json({
            message: 'Error retrieving pending notifications',
            error: error.message
        });
    }
});
exports.getPendingNotifications = getPendingNotifications;
// Process all pending notifications
const processNotifications = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const db = (0, database_sqlite_1.getDatabase)();
        const pendingNotifications = db.prepare(`
      SELECT n.*, u.phone, u.first_name, u.last_name
      FROM notifications n
      JOIN users u ON n.user_id = u.id
      WHERE n.status = 'pending'
      ORDER BY n.created_at ASC
    `).all();
        const results = [];
        for (const notification of pendingNotifications) {
            try {
                // Here you would integrate with your messaging service (e.g. Twilio)
                // For now, we'll just mark it as sent
                const updateStmt = db.prepare(`
          UPDATE notifications SET
            status = 'sent',
            error_message = NULL,
            updated_at = datetime('now')
          WHERE id = ?
        `);
                updateStmt.run(notification.id);
                results.push({
                    id: notification.id,
                    status: 'sent',
                    message: 'Notification processed successfully'
                });
            }
            catch (error) {
                results.push({
                    id: notification.id,
                    status: 'failed',
                    error: error.message
                });
            }
        }
        return res.json({
            processed: results.length,
            results
        });
    }
    catch (error) {
        console.error('Error processing notifications:', error);
        return res.status(500).json({
            message: 'Error processing notifications',
            error: error.message
        });
    }
});
exports.processNotifications = processNotifications;
// Process a single notification
const processSingleNotification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const db = (0, database_sqlite_1.getDatabase)();
        const notification = db.prepare(`
      SELECT n.*, u.phone, u.first_name, u.last_name
      FROM notifications n
      JOIN users u ON n.user_id = u.id
      WHERE n.id = ?
    `).get(id);
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        try {
            // Here you would integrate with your messaging service (e.g. Twilio)
            // For now, we'll just mark it as sent
            const updateStmt = db.prepare(`
        UPDATE notifications SET
          status = 'sent',
          error_message = NULL,
          updated_at = datetime('now')
        WHERE id = ?
      `);
            updateStmt.run(id);
            return res.json({
                id: notification.id,
                status: 'sent',
                message: 'Notification processed successfully'
            });
        }
        catch (error) {
            const updateStmt = db.prepare(`
        UPDATE notifications SET
          status = 'failed',
          error_message = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `);
            updateStmt.run(error.message, id);
            return res.status(500).json({
                id: notification.id,
                status: 'failed',
                error: error.message
            });
        }
    }
    catch (error) {
        console.error('Error processing notification:', error);
        return res.status(500).json({
            message: 'Error processing notification',
            error: error.message
        });
    }
});
exports.processSingleNotification = processSingleNotification;
// Update notification
const updateNotification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { message, template_id, appointment_id, variables } = req.body;
        const db = (0, database_sqlite_1.getDatabase)();
        // Check if notification exists
        const notificationExists = db.prepare('SELECT id FROM notifications WHERE id = ?').get(id);
        if (!notificationExists) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        let finalMessage = message;
        // If template_id is provided, get the template and replace variables
        if (template_id) {
            const template = db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(template_id);
            if (!template) {
                return res.status(400).json({ message: 'Template not found' });
            }
            finalMessage = template.content;
            // Replace variables if provided
            if (variables) {
                Object.keys(variables).forEach(key => {
                    finalMessage = finalMessage.replace(`{${key}}`, variables[key]);
                });
            }
        }
        // Update notification
        const updateStmt = db.prepare(`
      UPDATE notifications SET
        message = ?,
        template_id = ?,
        appointment_id = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `);
        updateStmt.run(finalMessage, template_id || null, appointment_id || null, id);
        // Get the updated notification
        const updatedNotification = db.prepare(`
      SELECT n.*, u.first_name, u.last_name
      FROM notifications n
      JOIN users u ON n.user_id = u.id
      WHERE n.id = ?
    `).get(id);
        return res.json(updatedNotification);
    }
    catch (error) {
        console.error('Error updating notification:', error);
        return res.status(500).json({
            message: 'Error updating notification',
            error: error.message
        });
    }
});
exports.updateNotification = updateNotification;
// Create notification from template
const createNotificationFromTemplate = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { user_id, template_id, appointment_id, variables } = req.body;
        // Validate required fields
        if (!user_id || !template_id) {
            return res.status(400).json({
                message: 'User ID and template ID are required'
            });
        }
        const db = (0, database_sqlite_1.getDatabase)();
        // Check if user exists
        const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id);
        if (!userExists) {
            return res.status(400).json({ message: 'User not found' });
        }
        // Get template
        const template = db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(template_id);
        if (!template) {
            return res.status(400).json({ message: 'Template not found' });
        }
        let finalMessage = template.content;
        // Get user details for variable replacement
        const user = db.prepare('SELECT first_name, last_name FROM users WHERE id = ?').get(user_id);
        // Replace user variables
        finalMessage = finalMessage
            .replace('{first_name}', user.first_name)
            .replace('{last_name}', user.last_name);
        // Replace appointment variables if appointment_id is provided
        if (appointment_id) {
            const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointment_id);
            if (appointment) {
                finalMessage = finalMessage
                    .replace('{appointment_date}', appointment.appointment_date)
                    .replace('{appointment_time}', appointment.appointment_time);
            }
        }
        // Replace custom variables if provided
        if (variables) {
            Object.keys(variables).forEach(key => {
                finalMessage = finalMessage.replace(`{${key}}`, variables[key]);
            });
        }
        // Insert notification
        const insertStmt = db.prepare(`
      INSERT INTO notifications (
        user_id, message, status, template_id, appointment_id
      ) VALUES (?, ?, 'pending', ?, ?)
    `);
        const result = insertStmt.run(user_id, finalMessage, template_id, appointment_id || null);
        const notificationId = result.lastInsertRowid;
        // Get the created notification
        const newNotification = db.prepare(`
      SELECT n.*, u.first_name, u.last_name
      FROM notifications n
      JOIN users u ON n.user_id = u.id
      WHERE n.id = ?
    `).get(notificationId);
        return res.status(201).json(newNotification);
    }
    catch (error) {
        console.error('Error creating notification from template:', error);
        return res.status(500).json({
            message: 'Error creating notification from template',
            error: error.message
        });
    }
});
exports.createNotificationFromTemplate = createNotificationFromTemplate;
// Resend notification
const resendNotification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const db = (0, database_sqlite_1.getDatabase)();
        const notification = db.prepare(`
      SELECT n.*, u.phone, u.first_name, u.last_name
      FROM notifications n
      JOIN users u ON n.user_id = u.id
      WHERE n.id = ?
    `).get(id);
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        // Reset notification status
        const updateStmt = db.prepare(`
      UPDATE notifications SET
        status = 'pending',
        error_message = NULL,
        updated_at = datetime('now')
      WHERE id = ?
    `);
        updateStmt.run(id);
        // Get the updated notification
        const updatedNotification = db.prepare(`
      SELECT n.*, u.first_name, u.last_name
      FROM notifications n
      JOIN users u ON n.user_id = u.id
      WHERE n.id = ?
    `).get(id);
        return res.json(updatedNotification);
    }
    catch (error) {
        console.error('Error resending notification:', error);
        return res.status(500).json({
            message: 'Error resending notification',
            error: error.message
        });
    }
});
exports.resendNotification = resendNotification;
