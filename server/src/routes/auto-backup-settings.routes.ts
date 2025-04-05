import express from 'express';
import { getAutoBackupSettings, updateAutoBackupSettings } from '../controllers/auto-backup-settings.controller';

const router = express.Router();

// Get auto backup settings
router.get('/auto-backup', getAutoBackupSettings);

// Update auto backup settings
router.post('/auto-backup', updateAutoBackupSettings);

export default router;