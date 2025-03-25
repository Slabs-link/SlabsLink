import express from 'express';
import * as templatesController from '../controllers/templates-sqlite.controller';

const router = express.Router();

// GET /api/templates - Get all templates
router.get('/', templatesController.getAllTemplates);

// GET /api/templates/:id - Get a template by ID
router.get('/:id', templatesController.getTemplateById);

// POST /api/templates - Create a new template
router.post('/', templatesController.createTemplate);

// PUT /api/templates/:id - Update a template
router.put('/:id', templatesController.updateTemplate);

// DELETE /api/templates/:id - Delete a template
router.delete('/:id', templatesController.deleteTemplate);

export default router;