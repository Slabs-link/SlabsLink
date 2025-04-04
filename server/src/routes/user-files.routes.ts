import { Router } from 'express';
import { 
  uploadUserFile, 
  getUserFiles, 
  getUserFile, 
  downloadUserFile, 
  deleteUserFile,
  upload
} from '../controllers/user-files.controller';

const router = Router();

// Rotta per caricare un file per un utente specifico
router.post('/:userId', upload.single('file'), uploadUserFile);

// Rotta per ottenere tutti i file di un utente specifico
router.get('/:userId', getUserFiles);

// Rotta per ottenere un file specifico di un utente
router.get('/:userId/:fileId', getUserFile);

// Rotta per scaricare un file specifico di un utente
router.get('/:userId/:fileId/download', downloadUserFile);

// Rotta per eliminare un file specifico di un utente
router.delete('/:userId/:fileId', deleteUserFile);

export default router;