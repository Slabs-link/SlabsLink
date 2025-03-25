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
exports.deleteTemplate = exports.updateTemplate = exports.createTemplate = exports.getTemplateById = exports.getAllTemplates = void 0;
const database_sqlite_1 = require("../config/database-sqlite");
// Get all templates
const getAllTemplates = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const db = (0, database_sqlite_1.getDatabase)();
        const templates = db.prepare(`
      SELECT * FROM notification_templates
      ORDER BY name ASC
    `).all();
        return res.json(templates);
    }
    catch (error) {
        console.error('Error getting templates:', error);
        return res.status(500).json({
            message: 'Error retrieving templates',
            error: error.message
        });
    }
});
exports.getAllTemplates = getAllTemplates;
// Get template by ID
const getTemplateById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const db = (0, database_sqlite_1.getDatabase)();
        const template = db.prepare(`
      SELECT * FROM notification_templates
      WHERE id = ?
    `).get(id);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }
        return res.json(template);
    }
    catch (error) {
        console.error('Error getting template:', error);
        return res.status(500).json({
            message: 'Error retrieving template',
            error: error.message
        });
    }
});
exports.getTemplateById = getTemplateById;
// Create new template
const createTemplate = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, type, content, description } = req.body;
        // Validate required fields
        if (!name || !type || !content) {
            return res.status(400).json({
                message: 'Name, type and content are required'
            });
        }
        const db = (0, database_sqlite_1.getDatabase)();
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
        const result = insertStmt.run(name, type, content, description || null);
        const templateId = result.lastInsertRowid;
        // Get the created template
        const newTemplate = db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(templateId);
        return res.status(201).json(newTemplate);
    }
    catch (error) {
        console.error('Error creating template:', error);
        return res.status(500).json({
            message: 'Error creating template',
            error: error.message
        });
    }
});
exports.createTemplate = createTemplate;
// Update template
const updateTemplate = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { name, type, content, description } = req.body;
        // Validate required fields
        if (!name || !type || !content) {
            return res.status(400).json({
                message: 'Name, type and content are required'
            });
        }
        const db = (0, database_sqlite_1.getDatabase)();
        // Check if template exists
        const template = db.prepare('SELECT is_system FROM notification_templates WHERE id = ?').get(id);
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
        updateStmt.run(name, type, content, description || null, id);
        // Get the updated template
        const updatedTemplate = db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(id);
        return res.json(updatedTemplate);
    }
    catch (error) {
        console.error('Error updating template:', error);
        return res.status(500).json({
            message: 'Error updating template',
            error: error.message
        });
    }
});
exports.updateTemplate = updateTemplate;
// Delete template
const deleteTemplate = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const db = (0, database_sqlite_1.getDatabase)();
        // Check if template exists
        const template = db.prepare('SELECT is_system FROM notification_templates WHERE id = ?').get(id);
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
    }
    catch (error) {
        console.error('Error deleting template:', error);
        return res.status(500).json({
            message: 'Error deleting template',
            error: error.message
        });
    }
});
exports.deleteTemplate = deleteTemplate;
