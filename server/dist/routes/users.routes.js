"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const users_sqlite_controller_1 = require("../controllers/users-sqlite.controller");
const router = express_1.default.Router();
// Aggiungiamo un endpoint di test
router.get('/test', (req, res) => {
    res.json({ message: 'Users routes are loaded correctly' });
});
// GET users count
router.get('/count', users_sqlite_controller_1.getUsersCount);
// GET recent users
router.get('/recent', users_sqlite_controller_1.getRecentUsers);
// GET all users
router.get('/', users_sqlite_controller_1.getAllUsers);
// GET a specific user
router.get('/:id', users_sqlite_controller_1.getUserById);
// POST create a new user
router.post('/', users_sqlite_controller_1.createUser);
// PUT update a user
router.put('/:id', users_sqlite_controller_1.updateUser);
// DELETE a user
router.delete('/:id', users_sqlite_controller_1.deleteUser);
// Log delle route registrate
console.log('Users routes registered:');
console.log('- GET /api/users/test');
console.log('- GET /api/users/count');
console.log('- GET /api/users/recent');
console.log('- GET /api/users');
console.log('- GET /api/users/:id');
console.log('- POST /api/users');
console.log('- PUT /api/users/:id');
console.log('- DELETE /api/users/:id');
exports.default = router;
