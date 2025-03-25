import { Router } from 'express';
import {
  getAllAppointmentTypes,
  getAppointmentTypeById,
  createAppointmentType,
  updateAppointmentType,
  deleteAppointmentType,
  getAppointmentTypeByName
} from '../controllers/appointment-types-sqlite.controller';

const router = Router();

// GET /api/appointment-types
router.get('/', getAllAppointmentTypes);

// GET /api/appointment-types/:id
router.get('/:id', getAppointmentTypeById);

// POST /api/appointment-types
router.post('/', createAppointmentType);

// PUT /api/appointment-types/:id
router.put('/:id', updateAppointmentType);

// DELETE /api/appointment-types/:id
router.delete('/:id', deleteAppointmentType);

export default router;