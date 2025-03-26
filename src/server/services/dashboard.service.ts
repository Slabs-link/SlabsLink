import { getDatabase } from '../../../server/src/db/db-sqlite';

export const getDashboardData = async () => {
  try {
    const db = getDatabase();
    const prepareStatement = (sql: string) => db.prepare(sql);

    const [appointments, patients, users] = await Promise.all([
      prepareStatement('SELECT COUNT(*) as total FROM appointments').get(),
      prepareStatement('SELECT COUNT(*) as total FROM patients').get(),
      prepareStatement('SELECT COUNT(*) as total FROM users').get()
    ]);

    return {
      appointments: (appointments as any).total,
      patients: (patients as any).total,
      users: (users as any).total,
      latestAppointments: await prepareStatement('SELECT * FROM appointments ORDER BY date DESC LIMIT 5').all()
    };
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Errore nel recupero dei dati della dashboard');
  }
};