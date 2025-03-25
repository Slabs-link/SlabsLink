import { Request, Response } from 'express';
import { getDatabase } from '../config/database-sqlite';

// Get users count
export const getUsersCount = async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    
    interface CountResult {
      count: number;
    }
    
    const result = db.prepare('SELECT COUNT(*) as count FROM users').get() as CountResult;
    
    return res.json({ count: result.count });
  } catch (error: any) {
    console.error('Error getting users count:', error);
    return res.status(500).json({ 
      message: 'Error retrieving users count', 
      error: error.message 
    });
  }
};

// Get all users
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    
    const users = db.prepare('SELECT * FROM users ORDER BY last_name, first_name').all();
    
    return res.json(users);
  } catch (error: any) {
    console.error('Error getting users:', error);
    return res.status(500).json({ 
      message: 'Error retrieving users', 
      error: error.message 
    });
  }
};

// Get user by ID
export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    return res.json(user);
  } catch (error: any) {
    console.error('Error getting user:', error);
    return res.status(500).json({ 
      message: 'Error retrieving user', 
      error: error.message 
    });
  }
};

// Create new user
// Create user
export const createUser = async (req: Request, res: Response) => {
  try {
    const { 
      first_name, 
      last_name, 
      email, 
      phone, 
      birth_date, 
      gender,
      fiscal_code,
      address,
      city,
      birth_city,
      birth_city_code,
    } = req.body;
    
    console.log('Received user data:', req.body);
    console.log('Birth city:', birth_city);
    console.log('Birth city code:', birth_city_code);
    
    // Validate required fields
    if (!first_name || !last_name) {
      return res.status(400).json({ 
        message: 'First name and last name are required' 
      });
    }
    
    const db = getDatabase();
    
    // Check if email already exists
    if (email) {
      const emailExists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (emailExists) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }
    
    // Check if fiscal_code already exists
    if (fiscal_code) {
      const fiscalCodeExists = db.prepare('SELECT id FROM users WHERE fiscal_code = ?').get(fiscal_code);
      if (fiscalCodeExists) {
        return res.status(400).json({ message: 'Fiscal code already in use' });
      }
    }
    
    // Insert user - assicurati che la query includa birth_city e birth_city_code
    const insertStmt = db.prepare(`
      INSERT INTO users (
        first_name, last_name, email, phone, birth_date, gender,
        fiscal_code, address, city, birth_city, birth_city_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    console.log('Executing SQL with values:', [
      first_name,
      last_name,
      email || null,
      phone || null,
      birth_date || null,
      gender || null,
      fiscal_code || null,
      address || null,
      city || null,
      birth_city || null,
      birth_city_code || null
    ]);
    
    const result = insertStmt.run(
      first_name,
      last_name,
      email || null,
      phone || null,
      birth_date || null,
      gender || null,
      fiscal_code || null,
      address || null,
      city || null,
      birth_city || null,
      birth_city_code || null
    );
    
    // Get the inserted user
    const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    
    return res.status(201).json(newUser);
  } catch (error: any) {
    console.error('Error creating user:', error);
    return res.status(500).json({ 
      message: 'Error creating user', 
      error: error.message 
    });
  }
};

// Update user
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      first_name, 
      last_name, 
      email, 
      phone, 
      birth_date, 
      gender,
      fiscal_code,
      address,
      city,
      birth_city,
      birth_city_code,
    } = req.body;
    
    console.log('Updating user with data:', req.body);
    console.log('Birth city:', birth_city);
    console.log('Birth city code:', birth_city_code);
    
    // Validate required fields
    if (!first_name || !last_name) {
      return res.status(400).json({ 
        message: 'First name and last name are required' 
      });
    }
    
    const db = getDatabase();
    
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
    
    // Check if fiscal_code already exists for another user
    if (fiscal_code) {
      const fiscalCodeExists = db.prepare('SELECT id FROM users WHERE fiscal_code = ? AND id != ?').get(fiscal_code, id);
      if (fiscalCodeExists) {
        return res.status(400).json({ message: 'Fiscal code already in use by another user' });
      }
    }
    
    // Update user - assicurati che la query includa birth_city e birth_city_code
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
        birth_city = ?,
        birth_city_code = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `);
    
    console.log('Executing SQL update with values:', [
      first_name,
      last_name,
      email || null,
      phone || null,
      birth_date || null,
      gender || null,
      fiscal_code || null,
      address || null,
      city || null,
      birth_city || null,
      birth_city_code || null,
      id
    ]);
    
    updateStmt.run(
      first_name,
      last_name,
      email || null,
      phone || null,
      birth_date || null,
      gender || null,
      fiscal_code || null,
      address || null,
      city || null,
      birth_city || null,
      birth_city_code || null,
      id
    );
    
    // Get the updated user
    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    
    return res.json(updatedUser);
  } catch (error: any) {
    console.error('Error updating user:', error);
    return res.status(500).json({ 
      message: 'Error updating user', 
      error: error.message 
    });
  }
};

// Delete user
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    const db = getDatabase();
    
    // Check if user exists
    const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!userExists) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Delete user with specific ID - assicurati di usare WHERE id = ?
    const deleteStmt = db.prepare('DELETE FROM users WHERE id = ?');
    deleteStmt.run(id);
    
    return res.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ 
      message: 'Error deleting user', 
      error: error.message 
    });
  }
};

// Get recent users
// Update the getRecentUsers function to include the new fields
export const getRecentUsers = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    const db = getDatabase();
    
    const users = db.prepare(`
      SELECT id, first_name, last_name, email, phone, birth_date, gender,
             fiscal_code, address, city, birth_city, birth_city_code,
             created_at, updated_at
      FROM users 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(limit);
    
    return res.json(users);
  } catch (error: any) {
    console.error('Error getting recent users:', error);
    return res.status(500).json({ 
      message: 'Error retrieving recent users', 
      error: error.message 
    });
  }
};