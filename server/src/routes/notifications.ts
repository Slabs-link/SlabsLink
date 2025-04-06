import express from 'express';
import WhatsAppService from '../services/whatsapp.service';
import { getDatabase } from '../config/database-sqlite';

// Definizione dell'interfaccia per l'appuntamento dal database
interface AppointmentWithPhone {
  id: string;
  date: string;
  time: string;
  patient_id: string;
  phone: string;
  [key: string]: any; // Per altre proprietà che potrebbero essere presenti
}

const router = express.Router();

// Send a WhatsApp notification
router.post('/whatsapp', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({ message: 'Phone number and message are required' });
    }
    
    // Send the WhatsApp message using the server-side service
    const success = await WhatsAppService.sendMessage(phoneNumber, message);
    
    if (success) {
      return res.status(200).json({ message: 'WhatsApp notification sent successfully' });
    } else {
      return res.status(500).json({ message: 'Failed to send WhatsApp notification' });
    }
  } catch (error) {
    console.error('Error sending WhatsApp notification:', error);
    return res.status(500).json({ 
      message: 'Error sending WhatsApp notification', 
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Send an appointment notification
router.post('/appointment/:id/send', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    // Get appointment details
    const appointment = db.prepare(`
      SELECT a.*, u.phone
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      WHERE a.id = ?
    `).get(id) as AppointmentWithPhone | undefined;
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    // Format the message
    const message = `Gentile paziente,\nLe confermiamo l'appuntamento per il giorno ${appointment.date} alle ore ${appointment.time}.\nLa aspettiamo!`;
    
    // Send the WhatsApp message
    const success = await WhatsAppService.sendMessage(appointment.phone, message);
    
    if (success) {
      // Mark notification as sent
      db.prepare(`
        UPDATE appointments
        SET notification_sent = 1
        WHERE id = ?
      `).run(id);
      
      return res.status(200).json({ message: 'Appointment notification sent successfully' });
    } else {
      return res.status(500).json({ message: 'Failed to send appointment notification' });
    }
  } catch (error) {
    console.error('Error sending appointment notification:', error);
    return res.status(500).json({ 
      message: 'Error sending appointment notification', 
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;