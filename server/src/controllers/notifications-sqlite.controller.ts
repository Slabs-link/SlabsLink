import { Request, Response } from 'express';
import { getDatabase } from '../config/database-sqlite';
import { Template, User, Appointment, Notification } from '../interfaces/notifications.interface';

// Interfaccia per le statistiche delle notifiche
interface NotificationCountStats {
  total_count: number;
  sent_count: number;
  pending_count: number;
  failed_count: number;
}

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
    
    // Calcola le statistiche delle notifiche
    const stats = {
      total_count: 0,
      sent_count: 0,
      pending_count: 0,
      failed_count: 0,
      categories: {}
    };
    
    // Esegui query per ottenere i conteggi
    const countStats = db.prepare(`
      SELECT 
        COUNT(*) as total_count,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
      FROM notifications
    `).get() as NotificationCountStats;
    
    // Aggiorna le statistiche con i risultati della query
    if (countStats) {
      stats.total_count = countStats.total_count || 0;
      stats.sent_count = countStats.sent_count || 0;
      stats.pending_count = countStats.pending_count || 0;
      stats.failed_count = countStats.failed_count || 0;
    }
    
    // Always return array even if empty
    return res.json({
      notifications: notifications || [],
      stats: stats,
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
      console.log('User not found:', user_id);
      return res.status(400).json({ 
        message: 'User not found',
        invalid_field: 'user_id',
        received_value: user_id
      });
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
          // Supporta sia il formato {{variable}} che {variable}
          finalMessage = finalMessage.replace(new RegExp(`\{\{${key}\}\}|\{${key}\}`, 'g'), variables[key]);
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
      console.log('Invalid request:', { user_id, template_id });
      return res.status(400).json({ 
        message: 'User ID and template ID are required',
        missing_fields: [!user_id && 'user_id', !template_id && 'template_id'].filter(Boolean)
      });
    }
    
    const db = getDatabase();
    
    // Check if user exists
    const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id);
    if (!userExists) {
      console.log('User not found:', user_id);
      return res.status(400).json({ 
        message: 'User not found',
        invalid_field: 'user_id',
        received_value: user_id
      });
    }
    
    // Get template
    const template = db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(template_id) as Template;
    if (!template) {
      console.log('Template not found:', template_id);
      return res.status(400).json({ 
        message: 'Template not found',
        invalid_field: 'template_id',
        received_value: template_id
      });
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

// Endpoint per le notifiche automatiche degli appuntamenti
export const createAppointmentNotification = async (req: Request, res: Response) => {
  try {
    const { appointmentId, notificationType } = req.body;
    
    // Validazione dei campi richiesti
    if (!appointmentId || !notificationType) {
      return res.status(400).json({ 
        message: 'ID appuntamento e tipo di notifica sono richiesti',
        missing_fields: [!appointmentId && 'appointmentId', !notificationType && 'notificationType'].filter(Boolean)
      });
    }
    
    const db = getDatabase();
    
    // Verifica se l'appuntamento esiste
    const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId) as Appointment;
    if (!appointment) {
      return res.status(404).json({ 
        message: 'Appuntamento non trovato',
        invalid_field: 'appointmentId',
        received_value: appointmentId
      });
    }
    
    // Ottieni l'utente associato all'appuntamento
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(appointment.patient_id) as User;
    if (!user) {
      return res.status(404).json({ 
        message: 'Utente associato all\'appuntamento non trovato',
        invalid_field: 'patient_id',
        received_value: appointment.patient_id
      });
    }
    
    // Determina il tipo di template da utilizzare in base al tipo di notifica
    let templateType = '';
    switch (notificationType) {
      case 'creation':
        templateType = 'appointment_created';
        break;
      case 'update':
        templateType = 'appointment_update';
        break;
      case 'cancellation':
        templateType = 'appointment_cancellation';
        break;
      default:
        return res.status(400).json({ 
          message: 'Tipo di notifica non valido',
          invalid_field: 'notificationType',
          received_value: notificationType
        });
    }
    
    // Ottieni il template appropriato
    const template = db.prepare('SELECT * FROM notification_templates WHERE type = ? LIMIT 1').get(templateType) as Template;
    if (!template) {
      return res.status(404).json({ 
        message: `Template per ${templateType} non trovato`,
        invalid_field: 'templateType',
        received_value: templateType
      });
    }
    
    // Prepara il messaggio con le variabili sostituite
    let finalMessage = template.content;
    
    // Sostituisci le variabili dell'utente
    finalMessage = finalMessage
      .replace(/\{\{first_name\}\}|\{first_name\}/g, user.first_name || '')
      .replace(/\{\{last_name\}\}|\{last_name\}/g, user.last_name || '');
    
    // Sostituisci le variabili dell'appuntamento
    finalMessage = finalMessage
      .replace(/\{\{appointment_date\}\}|\{appointment_date\}/g, appointment.appointment_date || appointment.date || '')
      .replace(/\{\{appointment_time\}\}|\{appointment_time\}/g, appointment.appointment_time || appointment.time || '')
      .replace(/\{\{appointment_title\}\}|\{appointment_title\}/g, appointment.title || 'Appuntamento');
    
    // Inserisci la notifica
    const insertStmt = db.prepare(`
      INSERT INTO notifications (
        user_id, message, status, template_id, appointment_id
      ) VALUES (?, ?, 'pending', ?, ?)
    `);
    
    const result = insertStmt.run(
      user.id,
      finalMessage,
      template.id,
      appointmentId
    );
    
    const notificationId = result.lastInsertRowid;
    
    // Ottieni la notifica creata
    const newNotification = db.prepare(`
      SELECT n.*, u.first_name, u.last_name
      FROM notifications n
      JOIN users u ON n.user_id = u.id
      WHERE n.id = ?
    `).get(notificationId) as Notification;
    
    return res.status(201).json({
      success: true,
      notification: newNotification,
      message: `Notifica per ${notificationType} appuntamento creata con successo`
    });
  } catch (error: any) {
    console.error('Errore nella creazione della notifica per appuntamento:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Errore nella creazione della notifica per appuntamento', 
      error: error.message 
    });
  }
};