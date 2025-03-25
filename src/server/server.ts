import express from 'express';
import dashboardRouter from './routes/dashboard.route';

const app = express();
const port = 3001;

app.use(express.json());

app.use('/api/dashboard', dashboardRouter);

app.listen(port, () => {
  console.log(`Server in ascolto sulla porta ${port}`);
});