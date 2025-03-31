import { Router } from 'express';
import { backupService } from '../services/backup.service';
import path from 'path';
import fs from 'fs/promises';

const router = Router();

// Get all backups
router.get('/', async (req, res) => {
  try {
    await backupService.ensureBackupDir();
    const files = await fs.readdir(backupService.backupDir);
    let backupFiles = files.filter(file => file.endsWith('.sqlite'));
    
    // Sort by date (newest first)
    // Ottieni le statistiche dei file prima di ordinarli
    const fileStats = await Promise.all(
      backupFiles.map(async (file) => {
        const stat = await fs.stat(path.join(backupService.backupDir, file));
        return {
          name: file,
          time: stat.mtime.getTime()
        };
      })
    );
    
    // Ora ordina in base alle statistiche già ottenute
    fileStats.sort((a, b) => b.time - a.time);
    backupFiles = fileStats.map(file => file.name);
    
    res.json(backupFiles);
  } catch (err) {
    console.error('Error getting backups:', err);
    res.status(500).json({ error: 'Failed to get backups' });
  }
});

// Create a new backup
router.post('/create', async (req, res) => {
  try {
    const backupPath = await backupService.createDatabaseBackup();
    res.json({ success: true, path: backupPath });
  } catch (err) {
    console.error('Error creating backup:', err);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// Restore from a backup
router.post('/restore', async (req, res) => {
  try {
    const { backup } = req.body;
    if (!backup) {
      return res.status(400).json({ error: 'Backup filename is required' });
    }
    
    const backupPath = path.join(backupService.backupDir, backup);
    
    // Check if file exists
    try {
      await fs.access(backupPath);
    } catch (err) {
      return res.status(404).json({ error: 'Backup file not found' });
    }
    
    await backupService.restoreDatabase(backupPath);
    res.json({ success: true });
  } catch (err) {
    console.error('Error restoring backup:', err);
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

// Delete a backup
router.delete('/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const backupPath = path.join(backupService.backupDir, filename);
    
    // Check if file exists
    try {
      await fs.access(backupPath);
    } catch (err) {
      return res.status(404).json({ error: 'Backup file not found' });
    }
    
    await fs.unlink(backupPath);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting backup:', err);
    res.status(500).json({ error: 'Failed to delete backup' });
  }
});

export default router;