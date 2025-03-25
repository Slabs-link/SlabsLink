import { Router } from 'express';
import { getLicenseInfo, updateLicense } from '../controllers/license-sqlite.controller';
import { loadLicenseFile } from '../controllers/license-file.controller';
import multer from 'multer';
import * as path from 'path';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Accept only JSON files
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.json') {
      return cb(new Error('Solo i file JSON sono supportati'));
    }
    cb(null, true);
  }
});

// Get license information
router.get('/', getLicenseInfo);

// Update license
router.post('/update', updateLicense);

// Import license from file
router.post('/import', upload.single('licenseFile'), loadLicenseFile);

export default router;