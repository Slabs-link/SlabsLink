import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const fsAsync = {
  readFile: promisify(fs.readFile),
  writeFile: promisify(fs.writeFile)
};

const SETTINGS_FILE = path.join(__dirname, '../../config.json');

interface AppSettings {
  backupEnabled: boolean;
  backupFrequency: string;
  backupPath: string;
  [key: string]: any;
}

const defaultSettings: AppSettings = {
  backupEnabled: true,
  backupFrequency: 'daily',
  backupPath: path.join(__dirname, '../../backups')
};

export const appSettings = {
  async get(key: string) {
    try {
      const settings: AppSettings = JSON.parse(await fsAsync.readFile(SETTINGS_FILE, 'utf-8'));
      return settings[key] || defaultSettings[key];
    } catch {
      return defaultSettings[key];
    }
  },

  async set(key: string, value: any) {
    let settings: AppSettings = {} as AppSettings;
    try {
      settings = JSON.parse(await fsAsync.readFile(SETTINGS_FILE, 'utf-8'));
    } catch {}
    
    settings[key] = value;
    await fsAsync.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  }
};