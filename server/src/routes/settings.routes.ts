import express from 'express';
import { 
  getAllSettings,
  getSettingByKey,
  updateSetting,
  deleteSetting,
  getWhatsappSettings,
  getCalendarSettings
} from '../controllers/settings-sqlite.controller';
import {
  getMedicalOfficeSettings,
  updateMedicalOfficeSettings
} from '../controllers/medical-office-settings.controller';

const router = express.Router();

// Get all settings
router.get('/', getAllSettings);

// Get whatsapp settings
router.get('/whatsapp', getWhatsappSettings);

// Get calendar settings
router.get('/calendar', getCalendarSettings);

// Get medical office settings
router.get('/medical-office', getMedicalOfficeSettings);

// Update medical office settings
router.post('/medical-office', updateMedicalOfficeSettings);

// Get setting by key
router.get('/:key', getSettingByKey);

// Update setting
router.put('/:key', updateSetting);

// Delete setting
router.delete('/:key', deleteSetting);

export default router;