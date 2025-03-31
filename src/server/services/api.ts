import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Interfaccia personalizzata che estende AxiosInstance con i metodi di backup
interface CustomAPI extends AxiosInstance {
  getBackups: () => Promise<AxiosResponse>;
  createBackup: () => Promise<AxiosResponse>;
  restoreBackup: (backup: string) => Promise<AxiosResponse>;
  deleteBackup: (backup: string) => Promise<AxiosResponse>;
}

// Creiamo l'istanza di axios
const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 10000,
}) as CustomAPI;

// Funzioni per la gestione dei backup
api.getBackups = async () => {
  return await api.get('/backups');
};

api.createBackup = async () => {
  return await api.post('/backups/create');
};

api.restoreBackup = async (backup: string) => {
  return await api.post('/backups/restore', { backup });
};

api.deleteBackup = async (backup: string) => {
  return await api.delete(`/backups/${encodeURIComponent(backup)}`);
};

export default api;