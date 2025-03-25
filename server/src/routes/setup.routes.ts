import express from 'express';
import { 
  checkSetupComplete as getSetupStatus,
  testDatabaseConnection,
  completeSetup
} from '../controllers/setup-sqlite.controller';

const router = express.Router();

// Remove the duplicate endpoint and keep only the one that uses the controller
// router.post('/complete', (req, res) => { ... }); - REMOVE THIS DUPLICATE

router.get('/status', getSetupStatus);
router.post('/test-db-connection', testDatabaseConnection);
router.post('/complete', completeSetup);

export default router;