import { Request, Response } from 'express';
import { getDatabase } from '../config/database-sqlite';

// Interface for appointment type
interface AppointmentType {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

// Get all appointment types
export const getAllAppointmentTypes = async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    
    const appointmentTypes = db.prepare('SELECT * FROM appointment_types ORDER BY name').all();
    
    return res.json(appointmentTypes);
  } catch (error: any) {
    console.error('Error getting appointment types:', error);
    return res.status(500).json({ 
      message: 'Error retrieving appointment types', 
      error: error.message 
    });
  }
};

// Get appointment type by ID
export const getAppointmentTypeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const appointmentType = db.prepare('SELECT * FROM appointment_types WHERE id = ?').get(id);
    
    if (!appointmentType) {
      return res.status(404).json({ message: 'Appointment type not found' });
    }
    
    return res.json(appointmentType);
  } catch (error: any) {
    console.error('Error getting appointment type:', error);
    return res.status(500).json({ 
      message: 'Error retrieving appointment type', 
      error: error.message 
    });
  }
};

// Create new appointment type
export const createAppointmentType = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    
    // Validate required fields
    if (!name) {
      return res.status(400).json({ 
        message: 'Name is required' 
      });
    }
    
    const db = getDatabase();
    
    // Check if name already exists
    const nameExists = db.prepare('SELECT id FROM appointment_types WHERE name = ?').get(name);
    if (nameExists) {
      return res.status(400).json({ message: 'Appointment type with this name already exists' });
    }
    
    // Insert appointment type
    const insertStmt = db.prepare(`
      INSERT INTO appointment_types (name, description)
      VALUES (?, ?)
    `);
    
    const result = insertStmt.run(name, description || null);
    
    // Get the inserted appointment type
    const newAppointmentType = db.prepare('SELECT * FROM appointment_types WHERE id = ?').get(result.lastInsertRowid);
    
    return res.status(201).json(newAppointmentType);
  } catch (error: any) {
    console.error('Error creating appointment type:', error);
    return res.status(500).json({ 
      message: 'Error creating appointment type', 
      error: error.message 
    });
  }
};

// Update appointment type
export const updateAppointmentType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    // Validate required fields
    if (!name) {
      return res.status(400).json({ 
        message: 'Name is required' 
      });
    }
    
    const db = getDatabase();
    
    // Check if appointment type exists
    const appointmentTypeExists = db.prepare('SELECT id FROM appointment_types WHERE id = ?').get(id);
    if (!appointmentTypeExists) {
      return res.status(404).json({ message: 'Appointment type not found' });
    }
    
    // Check if name already exists for another appointment type
    const nameExists = db.prepare('SELECT id FROM appointment_types WHERE name = ? AND id != ?').get(name, id);
    if (nameExists) {
      return res.status(400).json({ message: 'Another appointment type with this name already exists' });
    }
    
    // Update appointment type
    const updateStmt = db.prepare(`
      UPDATE appointment_types SET
        name = ?,
        description = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `);
    
    updateStmt.run(name, description || null, id);
    
    // Get the updated appointment type
    const updatedAppointmentType = db.prepare('SELECT * FROM appointment_types WHERE id = ?').get(id);
    
    return res.json(updatedAppointmentType);
  } catch (error: any) {
    console.error('Error updating appointment type:', error);
    return res.status(500).json({ 
      message: 'Error updating appointment type', 
      error: error.message 
    });
  }
};

// Delete appointment type
export const deleteAppointmentType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    // Check if appointment type exists
    const appointmentType = db.prepare('SELECT * FROM appointment_types WHERE id = ?').get(id);
    if (!appointmentType) {
      return res.status(404).json({ message: 'Appointment type not found' });
    }
    
    // Check if appointment type is in use
    const inUse = db.prepare('SELECT COUNT(*) as count FROM appointments WHERE appointment_type_id = ?').get(id) as { count: number } | undefined;
    if (inUse && inUse.count > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete appointment type that is in use by appointments' 
      });
    }
    
    // Delete appointment type
    db.prepare('DELETE FROM appointment_types WHERE id = ?').run(id);
    
    return res.json(appointmentType);
  } catch (error: any) {
    console.error('Error deleting appointment type:', error);
    return res.status(500).json({ 
      message: 'Error deleting appointment type', 
      error: error.message 
    });
  }
};

// Get appointment type by name
export const getAppointmentTypeByName = (name: string): AppointmentType | null => {
  try {
    if (!name) return null;
    
    const db = getDatabase();
    const appointmentType = db.prepare('SELECT * FROM appointment_types WHERE name = ?').get(name) as AppointmentType | undefined;
    
    return appointmentType || null;
  } catch (error) {
    console.error('Error getting appointment type by name:', error);
    return null;
  }
};