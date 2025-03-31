import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import { appSettings } from '../config/app-settings';

const execAsync = promisify(exec);
const fsAsync = {
  readFile: promisify(fs.readFile),
  writeFile: promisify(fs.writeFile),
  mkdir: promisify(fs.mkdir),
  readdir: promisify(fs.readdir),
  unlink: promisify(fs.unlink),
  stat: promisify(fs.stat),
  copyFile: promisify(fs.copyFile)
};

export class BackupService {
  public backupDir: string;
  private maxBackups: number;
  private backupEnabled: boolean;
  private backupFrequency: 'daily' | 'weekly' | 'monthly';

  constructor() {
    this.backupDir = path.join(__dirname, '../../backups');
    this.maxBackups = 5;
    this.backupEnabled = true;
    this.backupFrequency = 'daily';
    this.init();
  }

  async init() {
    this.backupEnabled = (await appSettings.get('backupEnabled')) || true;
    this.backupFrequency = (await appSettings.get('backupFrequency')) || 'daily';
  }

  async ensureBackupDir() {
    try {
      await fsAsync.mkdir(this.backupDir, { recursive: true });
    } catch (err) {
      console.error('Error creating backup directory:', err);
      throw err;
    }
  }

  async createDatabaseBackup() {
    await this.ensureBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `slabs-db-${timestamp}.sqlite`);
    
    try {
      await fsAsync.copyFile(
        path.join(__dirname, '../../data/slabs.db'),
        backupPath
      );
      console.log(`Database backup created: ${backupPath}`);
      await this.rotateBackups();
      return backupPath;
    } catch (err) {
      console.error('Error creating database backup:', err);
      throw err;
    }
  }

  async rotateBackups() {
    try {
      const files = await fsAsync.readdir(this.backupDir);
      const backupFiles = files
        .filter(file => file.startsWith('slabs-db-') && file.endsWith('.sqlite'))
        .map(file => ({
          name: file,
          time: fsAsync.stat(path.join(this.backupDir, file)).then(stat => stat.mtime.getTime())
        }));

      const resolvedFiles = await Promise.all(backupFiles.map(async f => ({
        name: f.name,
        time: await f.time
      })));
      resolvedFiles.sort((a, b) => a.time - b.time);

      if (resolvedFiles.length > this.maxBackups) {
        const filesToDelete = resolvedFiles.slice(0, resolvedFiles.length - this.maxBackups);
        for (const file of filesToDelete) {
          await fsAsync.unlink(path.join(this.backupDir, file.name));
          console.log(`Deleted old backup: ${file.name}`);
        }
      }
    } catch (err) {
      console.error('Error rotating backups:', err);
      throw err;
    }
  }

  async restoreDatabase(backupPath: string) {
    try {
      await fsAsync.copyFile(
        backupPath,
        path.join(__dirname, '../../data/slabs.db')
      );
      console.log(`Database restored from: ${backupPath}`);
      return true;
    } catch (err) {
      console.error('Error restoring database:', err);
      throw err;
    }
  }

  async scheduleBackups() {
    if (!this.backupEnabled) return;

    let backupInterval: number;
    switch(this.backupFrequency) {
      case 'daily':
        backupInterval = 24 * 60 * 60 * 1000;
        break;
      case 'weekly':
        backupInterval = 7 * 24 * 60 * 60 * 1000;
        break;
      case 'monthly':
        backupInterval = 30 * 24 * 60 * 60 * 1000;
        break;
      default:
        backupInterval = 24 * 60 * 60 * 1000;
    }

    setInterval(async () => {
      try {
        await this.createDatabaseBackup();
      } catch (err) {
        console.error('Scheduled backup failed:', err);
      }
    }, backupInterval);
  }

  setBackupEnabled(enabled: boolean) {
    this.backupEnabled = enabled;
    appSettings.set('backupEnabled', enabled);
  }

  setBackupFrequency(frequency: 'daily' | 'weekly' | 'monthly') {
    this.backupFrequency = frequency;
    appSettings.set('backupFrequency', frequency);
  }

  setBackupPath(path: string) {
    this.backupDir = path;
    appSettings.set('backupPath', path);
  }
}

export const backupService = new BackupService();