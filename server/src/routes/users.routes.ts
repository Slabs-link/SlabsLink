import express from 'express';
import { getAllUsers, getUserById, createUser, updateUser, deleteUser, getUsersCount, getRecentUsers } from '../controllers/users-sqlite.controller';

const router = express.Router();

// Aggiungiamo un endpoint di test
router.get('/test', (req, res) => {
  res.json({ message: 'Users routes are loaded correctly' });
});

// GET users count
router.get('/count', getUsersCount);

// GET recent users
router.get('/recent', getRecentUsers);

// GET all users
router.get('/', getAllUsers);

// GET a specific user
router.get('/:id', getUserById);

// POST create a new user
router.post('/', createUser);

// PUT update a user
router.put('/:id', updateUser);

// DELETE a user
router.delete('/:id', deleteUser);

// Log delle route registrate
console.log('Users routes registered:');
console.log('- GET /api/users/test');
console.log('- GET /api/users/count');
console.log('- GET /api/users/recent');
console.log('- GET /api/users');
console.log('- GET /api/users/:id');
console.log('- POST /api/users');
console.log('- PUT /api/users/:id');
console.log('- DELETE /api/users/:id')

export default router;