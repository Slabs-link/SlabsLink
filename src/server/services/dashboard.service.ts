import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';

export const getDashboardData = async () => {
  try {
    // Utilizza il pool di connessioni esistente
const pool = require('../../database/db');

const promisifiedDb = {
  get: (sql: string, params?: any[]) => pool.get(sql, params),
  all: (sql: string, params?: any[]) => pool.all(sql, params)
};

    const [appointments, patients, users] = await Promise.all([
      promisifiedDb.get('SELECT COUNT(*) as total FROM appointments'),
      promisifiedDb.get('SELECT COUNT(*) as total FROM patients'),
      promisifiedDb.get('SELECT COUNT(*) as total FROM users')
    ]);

    return {
      appointments: appointments.total,
      patients: patients.total,
      users: users.total,
      latestAppointments: await promisifiedDb.all('SELECT * FROM appointments ORDER BY date DESC LIMIT 5')
    };
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Errore nel recupero dei dati della dashboard');
  }
};