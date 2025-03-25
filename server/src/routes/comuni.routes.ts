import express from 'express';
import { 
  getAllComuni, 
  searchComuniByName, 
  getComuneByCode,
  searchComuniForUserForm
} from '../controllers/comuni-sqlite.controller';

const router = express.Router();

router.get('/', getAllComuni);
router.get('/search', searchComuniByName);
router.get('/code/:code', getComuneByCode);
router.get('/user-form', searchComuniForUserForm);

export default router;