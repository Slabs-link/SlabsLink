import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

export const backupService = {
  getBackups: async () => {
    return await axios.get(`${API_BASE_URL}/backups`);
  },
  
  createBackup: async () => {
    return await axios.post(`${API_BASE_URL}/backups/create`);
  },
  
  restoreBackup: async (backup: string) => {
    return await axios.post(`${API_BASE_URL}/backups/restore`, { backup });
  },
  
  deleteBackup: async (backup: string) => {
    return await axios.delete(`${API_BASE_URL}/backups/${encodeURIComponent(backup)}`);
  },
  
  // Nuove funzioni per il backup automatico
  getAutoBackupSettings: async () => {
    return await axios.get(`${API_BASE_URL}/settings/auto-backup`);
  },
  
  saveAutoBackupSettings: async (settings: { enabled: boolean, frequency: number, maxBackups: number, backupPath?: string }) => {
    return await axios.post(`${API_BASE_URL}/settings/auto-backup`, settings);
  }
};