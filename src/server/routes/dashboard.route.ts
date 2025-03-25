import express from 'express';
import { getDashboardData } from '../services/dashboard.service';

const router = express.Router();

router.get('/api/dashboard', async (req, res) => {
  try {
    const dashboardData = await getDashboardData();
    res.json(dashboardData);
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ message: 'Error retrieving dashboard data' });
  }
});

export default router;