"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecentUsers = exports.deleteUser = exports.updateUser = exports.createUser = exports.getUserById = exports.getAllUsers = exports.getUsersCount = void 0;
const database_sqlite_1 = require("../config/database-sqlite");
// Get users count
const getUsersCount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const db = (0, database_sqlite_1.getDatabase)();
        const result = db.prepare('SELECT COUNT(*) as count FROM users').get();
        return res.json({ count: result.count });
    }
    catch (error) {
        console.error('Error getting users count:', error);
        return res.status(500).json({
            message: 'Error retrieving users count',
            error: error.message
        });
    }
});
exports.getUsersCount = getUsersCount;
// Get all users
const getAllUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const db = (0, database_sqlite_1.getDatabase)();
        const users = db.prepare('SELECT * FROM users ORDER BY last_name, first_name').all();
        return res.json(users);
    }
    catch (error) {
        console.error('Error getting users:', error);
        return res.status(500).json({
            message: 'Error retrieving users',
            error: error.message
        });
    }
});
exports.getAllUsers = getAllUsers;
// Get user by ID
const getUserById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const db = (0, database_sqlite_1.getDatabase)();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        return res.json(user);
    }
    catch (error) {
        console.error('Error getting user:', error);
        return res.status(500).json({
            message: 'Error retrieving user',
            error: error.message
        });
    }
});
exports.getUserById = getUserById;
// Create new user
const createUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { first_name, last_name, email, phone, birth_date, gender, fiscal_code, address, city } = req.body;
        // Validate required fields
        if (!first_name || !last_name) {
            return res.status(400).json({
                message: 'First name and last name are required'
            });
        }
        const db = (0, database_sqlite_1.getDatabase)();
        // Check if email already exists
        if (email) {
            const emailExists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
            if (emailExists) {
                return res.status(400).json({ message: 'Email already in use' });
            }
        }
        // Insert user
        const insertStmt = db.prepare(`
      INSERT INTO users (
        first_name, last_name, email, phone, birth_date, gender, fiscal_code, address, city
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = insertStmt.run(first_name, last_name, email || null, phone || null, birth_date || null, gender || null, fiscal_code || null, address || null, city || null);
        const userId = result.lastInsertRowid;
        // Get the created user
        const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        return res.status(201).json(newUser);
    }
    catch (error) {
        console.error('Error creating user:', error);
        return res.status(500).json({
            message: 'Error creating user',
            error: error.message
        });
    }
});
exports.createUser = createUser;
// Update user
const updateUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { first_name, last_name, email, phone, birth_date, gender, fiscal_code, address, city } = req.body;
        // Validate required fields
        if (!first_name || !last_name) {
            return res.status(400).json({
                message: 'First name and last name are required'
            });
        }
        const db = (0, database_sqlite_1.getDatabase)();
        // Check if user exists
        const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
        if (!userExists) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Check if email already exists for another user
        if (email) {
            const emailExists = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, id);
            if (emailExists) {
                return res.status(400).json({ message: 'Email already in use by another user' });
            }
        }
        // Update user
        const updateStmt = db.prepare(`
      UPDATE users SET
        first_name = ?,
        last_name = ?,
        email = ?,
        phone = ?,
        birth_date = ?,
        gender = ?,
        fiscal_code = ?,
        address = ?,
        city = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `);
        updateStmt.run(first_name, last_name, email || null, phone || null, birth_date || null, gender || null, fiscal_code || null, address || null, city || null, id);
        // Get the updated user
        const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        return res.json(updatedUser);
    }
    catch (error) {
        console.error('Error updating user:', error);
        return res.status(500).json({
            message: 'Error updating user',
            error: error.message
        });
    }
});
exports.updateUser = updateUser;
// Delete user
const deleteUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const db = (0, database_sqlite_1.getDatabase)();
        // Check if user exists
        const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
        if (!userExists) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Check if user has appointments
        const hasAppointments = db.prepare('SELECT id FROM appointments WHERE patient_id = ? LIMIT 1').get(id);
        if (hasAppointments) {
            return res.status(400).json({
                message: 'Cannot delete user with appointments. Delete appointments first.'
            });
        }
        // Delete user
        db.prepare('DELETE FROM users WHERE id = ?').run(id);
        return res.json({ message: 'User deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting user:', error);
        return res.status(500).json({
            message: 'Error deleting user',
            error: error.message
        });
    }
});
exports.deleteUser = deleteUser;
// Get recent users
const getRecentUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const limit = parseInt(req.query.limit) || 5;
        const db = (0, database_sqlite_1.getDatabase)();
        const users = db.prepare(`
      SELECT * FROM users 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(limit);
        return res.json(users);
    }
    catch (error) {
        console.error('Error getting recent users:', error);
        return res.status(500).json({
            message: 'Error retrieving recent users',
            error: error.message
        });
    }
});
exports.getRecentUsers = getRecentUsers;
