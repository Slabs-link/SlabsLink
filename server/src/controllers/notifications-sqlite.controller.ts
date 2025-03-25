import { Request, Response } from 'express';
import { getDatabase } from '../config/database-sqlite';
import { Template, User, Appointment, Notification } from '../interfaces/notifications.interface';

// Get all notifications
export const getAllNotifications = async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    
    const notifications = db.prepare(`
      SELECT n.*, u.first_name, u.last_name
      FROM notifications n
      LEFT JOIN users u ON n.user_id = u.id
      ORDER BY n.created_at DESC
    `).all();
    
    // Always return array even if empty
    return res.json({
      notifications: notifications || [],
      success: true
    });
  } catch (error: any) {
    console.error('Error getting notifications:', error);
    return res.status(500).json({
      success: false,
      notifications: [],
      message: 'Error retrieving notifications',
      error: error.message
    });
  }
};

// Get notification by ID
export const getNotificationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const notification = db.prepare(`
      SELECT n.*, u.first_name, u.last_name
      FROM notifications n
      JOIN users u ON n.user_id = u.id
      WHERE n.id = ?
    `).get(id) as Notification;
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    return res.json(notification);
  } catch (error: any) {
    console.error('Error getting notification:', error);
    return res.status(500).json({ 
      message: 'Error retrieving notification', 
      error: error.message 
    });
  }
};

// Create new notification
export const createNotification = async (req: Request, res: Response) => {
  try {
    const { 
      user_id, 
      message, 
      template_id,
      appointment_id,
      variables
    } = req.body;
    
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
    
    const db = getDatabase();
    
    // Check if user exists
    const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id);
    if (!userExists) {
      return res.status(400).json({ message: 'User not found' });
    }
    
    let finalMessage = message;
    
    // If template_id is provided, get the template and replace variables
    if (template_id) {
      const template = db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(template_id) as Template;
      
      if (!template) {
        return res.status(400).json({ message: 'Template not found' });
      }
      
      finalMessage = template.content;
      
      // Get user details for variable replacement
      const user = db.prepare('SELECT first_name, last_name FROM users WHERE id = ?').get(user_id) as User;
      
      // Replace user variables
      finalMessage = finalMessage
        .replace('{first_name}', user.first_name)
        .replace('{last_name}', user.last_name);
      
      // Replace appointment variables if appointment_id is provided
      if (appointment_id) {
        const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointment_id) as Appointment;
        
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
    
    const result = insertStmt.run(
      user_id,
      finalMessage,
      template_id || null,
      appointment_id || null
    );
    
    const notificationId = result.lastInsertRowid;
    
    // Get the created notification
    const newNotification = db.prepare(`
      SELECT n.*, u.first_name, u.last_name
      FROM notifications n
      JOIN users u ON n.user_id = u.id
      WHERE n.id = ?
    `).get(notificationId) as Notification;
    
    return res.status(201).json(newNotification);
  } catch (error: any) {
    console.error('Error creating notification:', error);
    return res.status(500).json({ 
      message: 'Error creating notification', 
      error: error.message 
    });
  }
};

// Update notification status
export const updateNotificationStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, error_message } = req.body;
    
    // Validate required fields
    if (!status) {
      return res.status(400).json({ 
        message: 'Status is required' 
      });
    }
    
    const db = getDatabase();
    
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
    
    updateStmt.run(
      status,
      error_message || null,
      id
    );
    
    // Get the updated notification
    const updatedNotification = db.prepare(`
      SELECT n.*, u.first_name, u.last_name
      FROM notifications n
      JOIN users u ON n.user_id = u.id
      WHERE n.id = ?
    `).get(id);
    
    return res.json(updatedNotification);
  } catch (error: any) {
    console.error('Error updating notification status:', error);
    return res.status(500).json({ 
      message: 'Error updating notification status', 
      error: error.message 
    });
  }
};

// Delete notification
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    // Check if notification exists
    const notificationExists = db.prepare('SELECT id FROM notifications WHERE id = ?').get(id);
    if (!notificationExists) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    // Delete notification
    db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
    
    return res.json({ message: 'Notification deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting notification:', error);
    return res.status(500).json({ 
      message: 'Error deleting notification', 
      error: error.message 
    });
  }
};

// Get pending notifications
export const getPendingNotifications = async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    
    const notifications = db.prepare(`
      SELECT n.*, u.phone, u.first_name, u.last_name
      FROM notifications n
      JOIN users u ON n.user_id = u.id
      WHERE n.status = 'pending'
      ORDER BY n.created_at ASC
    `).all();
    
    return res.json({ notifications: notifications || [] });
  } catch (error: any) {
    console.error('Error getting pending notifications:', error);
    return res.status(500).json({ 
      message: 'Error retrieving pending notifications', 
      error: error.message 
    });
  }
};

interface NotificationWithUser extends Notification {
  phone?: string;
}

// Process all pending notifications
export const processNotifications = async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    
    const pendingNotifications = db.prepare(`
      SELECT n.*, u.phone, u.first_name, u.last_name
      FROM notifications n
      JOIN users u ON n.user_id = u.id
      WHERE n.status = 'pending'
      ORDER BY n.created_at ASC
    `).all() as NotificationWithUser[];
    
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
      } catch (error: any) {
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
  } catch (error: any) {
    console.error('Error processing notifications:', error);
    return res.status(500).json({ 
      message: 'Error processing notifications', 
      error: error.message 
    });
  }
};

// Process a single notification
export const processSingleNotification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const notification = db.prepare(`
      SELECT n.*, u.phone, u.first_name, u.last_name
      FROM notifications n
      JOIN users u ON n.user_id = u.id
      WHERE n.id = ?
    `).get(id) as NotificationWithUser;
    
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
    } catch (error: any) {
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
  } catch (error: any) {
    console.error('Error processing notification:', error);
    return res.status(500).json({ 
      message: 'Error processing notification', 
      error: error.message 
    });
  }
};

// Update notification
export const updateNotification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { message, template_id, appointment_id, variables } = req.body;
    
    const db = getDatabase();
    
    // Check if notification exists
    const notificationExists = db.prepare('SELECT id FROM notifications WHERE id = ?').get(id);
    if (!notificationExists) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    let finalMessage = message;
    
    // If template_id is provided, get the template and replace variables
    if (template_id) {
      const template = db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(template_id) as Template;
      
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
    
    updateStmt.run(
      finalMessage,
      template_id || null,
      appointment_id || null,
      id
    );
    
    // Get the updated notification
    const updatedNotification = db.prepare(`
      SELECT n.*, u.first_name, u.last_name
      FROM notifications n
      JOIN users u ON n.user_id = u.id
      WHERE n.id = ?
    `).get(id);
    
    return res.json(updatedNotification);
  } catch (error: any) {
    console.error('Error updating notification:', error);
    return res.status(500).json({ 
      message: 'Error updating notification', 
      error: error.message 
    });
  }
};

// Create notification from template
export const createNotificationFromTemplate = async (req: Request, res: Response) => {
  try {
    const { 
      user_id, 
      template_id,
      appointment_id,
      variables
    } = req.body;
    
    // Validate required fields
    if (!user_id || !template_id) {
      return res.status(400).json({ 
        message: 'User ID and template ID are required' 
      });
    }
    
    const db = getDatabase();
    
    // Check if user exists
    const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id);
    if (!userExists) {
      return res.status(400).json({ message: 'User not found' });
    }
    
    // Get template
    const template = db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(template_id) as Template;
    if (!template) {
      return res.status(400).json({ message: 'Template not found' });
    }
    
    let finalMessage = template.content;
    
    // Get user details for variable replacement
    const user = db.prepare('SELECT first_name, last_name FROM users WHERE id = ?').get(user_id) as User;
    
    // Replace user variables
    finalMessage = finalMessage
      .replace('{first_name}', user.first_name)
      .replace('{last_name}', user.last_name);
    
    // Replace appointment variables if appointment_id is provided
    if (appointment_id) {
      const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointment_id) as Appointment;
      
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
    
    const result = insertStmt.run(
      user_id,
      finalMessage,
      template_id,
      appointment_id || null
    );
    
    const notificationId = result.lastInsertRowid;
    
    // Get the created notification
    const newNotification = db.prepare(`
      SELECT n.*, u.first_name, u.last_name
      FROM notifications n
      JOIN users u ON n.user_id = u.id
      WHERE n.id = ?
    `).get(notificationId) as Notification;
    
    return res.status(201).json(newNotification);
  } catch (error: any) {
    console.error('Error creating notification from template:', error);
    return res.status(500).json({ 
      message: 'Error creating notification from template', 
      error: error.message 
    });
  }
};

// Resend notification
export const resendNotification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    // Check if notification exists
    interface NotificationWithUser extends Notification {
      phone?: string;
    }

    const notification = db.prepare(`
      SELECT n.*, u.phone, u.first_name, u.last_name
      FROM notifications n
      JOIN users u ON n.user_id = u.id
      WHERE n.id = ?
    `).get(id) as NotificationWithUser;
    
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
    
    return res.json({ notifications: notification || [] });
  } catch (error: any) {
    console.error('Error resending notification:', error);
    return res.status(500).json({ 
      message: 'Error resending notification', 
      error: error.message 
    });
  }
};