import { Request, Response } from 'express';
import { getDatabase } from '../config/database-sqlite';

// Define Template interface
interface Template {
  id: number;
  name: string;
  type: string;
  content: string;
  description?: string;
  is_system: number;
  created_at?: string;
  updated_at?: string;
}

// Get all templates
export const getAllTemplates = async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    
    const templates = db.prepare(`
      SELECT * FROM notification_templates
      ORDER BY name ASC
    `).all();
    
    return res.json(templates);
  } catch (error: any) {
    console.error('Error getting templates:', error);
    return res.status(500).json({ 
      message: 'Error retrieving templates', 
      error: error.message 
    });
  }
};

// Get template by ID
export const getTemplateById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const template = db.prepare(`
      SELECT * FROM notification_templates
      WHERE id = ?
    `).get(id);
    
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    
    return res.json(template);
  } catch (error: any) {
    console.error('Error getting template:', error);
    return res.status(500).json({ 
      message: 'Error retrieving template', 
      error: error.message 
    });
  }
};

// Create new template
export const createTemplate = async (req: Request, res: Response) => {
  try {
    const { 
      name, 
      type, 
      content, 
      description
    } = req.body;
    
    // Validate required fields
    if (!name || !type || !content) {
      return res.status(400).json({ 
        message: 'Name, type and content are required' 
      });
    }
    
    const db = getDatabase();
    
    // Check if template with same name already exists
    const nameExists = db.prepare('SELECT id FROM notification_templates WHERE name = ?').get(name);
    if (nameExists) {
      return res.status(400).json({ message: 'Template with this name already exists' });
    }
    
    // Insert template
    const insertStmt = db.prepare(`
      INSERT INTO notification_templates (
        name, type, content, description, is_system
      ) VALUES (?, ?, ?, ?, 0)
    `);
    
    const result = insertStmt.run(
      name,
      type,
      content,
      description || null
    );
    
    const templateId = result.lastInsertRowid;
    
    // Get the created template
    const newTemplate = db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(templateId);
    
    return res.status(201).json(newTemplate);
  } catch (error: any) {
    console.error('Error creating template:', error);
    return res.status(500).json({ 
      message: 'Error creating template', 
      error: error.message 
    });
  }
};

// Update template
export const updateTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      type, 
      content, 
      description
    } = req.body;
    
    // Validate required fields
    if (!name || !type || !content) {
      return res.status(400).json({ 
        message: 'Name, type and content are required' 
      });
    }
    
    const db = getDatabase();
    
    // Check if template exists
    const template = db.prepare('SELECT is_system FROM notification_templates WHERE id = ?').get(id) as Template | undefined;
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    
    // Prevent modification of system templates
    if (template.is_system === 1) {
      return res.status(403).json({ 
        message: 'System templates cannot be modified' 
      });
    }
    
    // Check if template with same name already exists (excluding current template)
    const nameExists = db.prepare('SELECT id FROM notification_templates WHERE name = ? AND id != ?').get(name, id);
    if (nameExists) {
      return res.status(400).json({ message: 'Template with this name already exists' });
    }
    
    // Update template
    const updateStmt = db.prepare(`
      UPDATE notification_templates SET
        name = ?,
        type = ?,
        content = ?,
        description = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `);
    
    updateStmt.run(
      name,
      type,
      content,
      description || null,
      id
    );
    
    // Get the updated template
    const updatedTemplate = db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(id);
    
    return res.json(updatedTemplate);
  } catch (error: any) {
    console.error('Error updating template:', error);
    return res.status(500).json({ 
      message: 'Error updating template', 
      error: error.message 
    });
  }
};

// Delete template
export const deleteTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    // Check if template exists
    const template = db.prepare('SELECT is_system FROM notification_templates WHERE id = ?').get(id) as Template | undefined;
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    
    // Prevent deletion of system templates
    if (template.is_system === 1) {
      return res.status(403).json({ 
        message: 'System templates cannot be deleted' 
      });
    }
    
    // Check if template is being used by any notification
    const isUsed = db.prepare('SELECT id FROM notifications WHERE template_id = ? LIMIT 1').get(id);
    if (isUsed) {
      return res.status(400).json({ 
        message: 'Cannot delete template that is being used by notifications' 
      });
    }
    
    // Delete template
    db.prepare('DELETE FROM notification_templates WHERE id = ?').run(id);
    
    return res.json({ message: 'Template deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting template:', error);
    return res.status(500).json({ 
      message: 'Error deleting template', 
      error: error.message 
    });
  }
};