import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import multer from 'multer';
import { getDatabase } from '../config/database-sqlite';

// Directory di base per i file degli utenti
const USER_FILES_BASE_DIR = path.resolve(process.cwd(), 'uploads/user-files');

// Log del percorso per debug
console.log('Directory di base per i file degli utenti:', USER_FILES_BASE_DIR);

// Assicurati che la directory di base esista
if (!fs.existsSync(USER_FILES_BASE_DIR)) {
  console.log('Creazione directory per i file degli utenti...');
  fs.mkdirSync(USER_FILES_BASE_DIR, { recursive: true });
  console.log('Directory creata con successo');
}

// Configura multer per il caricamento dei file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.params.userId;
    const userDir = path.join(USER_FILES_BASE_DIR, userId);
    
    console.log(`Tentativo di salvare file nella directory: ${userDir}`);
    
    // Crea la directory dell'utente se non esiste
    if (!fs.existsSync(userDir)) {
      console.log(`Directory utente ${userId} non esiste, creazione in corso...`);
      try {
        fs.mkdirSync(userDir, { recursive: true });
        console.log(`Directory utente ${userId} creata con successo`);
      } catch (error) {
        console.error(`Errore durante la creazione della directory: ${error}`);
      }
    }
    
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    // Genera un nome file univoco mantenendo l'estensione originale
    const originalExt = path.extname(file.originalname);
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${originalExt}`;
    cb(null, fileName);
  }
});

// Crea l'uploader con le configurazioni
export const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Limite di 10MB per file
  },
  fileFilter: (req, file, cb) => {
    // Accetta solo determinati tipi di file
    const allowedMimeTypes = [
      'application/pdf', 
      'image/jpeg', 
      'image/png', 
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'application/json'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo di file non supportato'));
    }
  }
});

// Interfaccia per i file degli utenti nel database
interface UserFile {
  id: number;
  user_id: number;
  file_name: string;
  original_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

// Carica un file per un utente specifico
export const uploadUserFile = async (req: Request, res: Response) => {
  try {
    console.log('Richiesta di upload file ricevuta');
    const { userId } = req.params;
    const { description } = req.body;
    
    console.log(`Upload file per utente ID: ${userId}`);
    console.log('File ricevuto:', req.file ? req.file.originalname : 'Nessun file');
    
    // Verifica che l'utente esista
    const db = getDatabase();
    const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    
    if (!userExists) {
      console.log(`Utente con ID ${userId} non trovato`);
      return res.status(404).json({ message: 'Utente non trovato' });
    }
    
    // Verifica che il file sia stato caricato
    if (!req.file) {
      console.log('Nessun file ricevuto nella richiesta');
      return res.status(400).json({ message: 'Nessun file caricato' });
    }
    
    // Salva le informazioni del file nel database
    const fileInfo = {
      user_id: userId,
      file_name: req.file.filename,
      original_name: req.file.originalname,
      file_path: req.file.path,
      file_type: req.file.mimetype,
      file_size: req.file.size,
      description: description || null
    };
    
    // Verifica se la tabella user_files esiste, altrimenti creala
    console.log('Verifica esistenza tabella user_files...');
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='user_files'"
    ).get();
    
    if (!tableExists) {
      console.log('Tabella user_files non esiste, creazione in corso...');
      try {
        db.prepare(`
          CREATE TABLE user_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            file_name TEXT NOT NULL,
            original_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `).run();
        console.log('Tabella user_files creata con successo');
      } catch (error) {
        console.error('Errore durante la creazione della tabella user_files:', error);
        throw error;
      }
    } else {
      console.log('Tabella user_files già esistente');
    }
    
    // Inserisci il record del file
    const result = db.prepare(`
      INSERT INTO user_files (
        user_id, file_name, original_name, file_path, file_type, file_size, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      fileInfo.user_id,
      fileInfo.file_name,
      fileInfo.original_name,
      fileInfo.file_path,
      fileInfo.file_type,
      fileInfo.file_size,
      fileInfo.description
    );
    
    // Ottieni il record appena inserito
    const newFile = db.prepare('SELECT * FROM user_files WHERE id = ?').get(result.lastInsertRowid);
    
    return res.status(201).json(newFile);
  } catch (error: any) {
    console.error('Errore durante il caricamento del file:', error);
    return res.status(500).json({ 
      message: 'Errore durante il caricamento del file', 
      error: error.message 
    });
  }
};

// Ottieni tutti i file di un utente specifico
export const getUserFiles = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    console.log(`Richiesta di ottenere file per utente ID: ${userId}`);
    
    // Verifica che l'utente esista
    const db = getDatabase();
    const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    
    if (!userExists) {
      console.log(`Utente con ID ${userId} non trovato`);
      return res.status(404).json({ message: 'Utente non trovato' });
    }
    
    // Verifica se la tabella user_files esiste
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='user_files'"
    ).get();
    
    if (!tableExists) {
      console.log('Tabella user_files non esiste, restituisco array vuoto');
      return res.json({ files: [] });
    }
    
    // Ottieni tutti i file dell'utente
    console.log(`Recupero file per utente ID: ${userId}`);
    const files = db.prepare('SELECT * FROM user_files WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    console.log(`Trovati ${files.length} file per l'utente`);
    
    return res.json({ files: files });
  } catch (error: any) {
    console.error('Errore durante il recupero dei file dell\'utente:', error);
    return res.status(500).json({ 
      message: 'Errore durante il recupero dei file dell\'utente', 
      error: error.message 
    });
  }
};

// Ottieni un file specifico di un utente
export const getUserFile = async (req: Request, res: Response) => {
  try {
    const { userId, fileId } = req.params;
    
    // Verifica che l'utente esista
    const db = getDatabase();
    const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    
    if (!userExists) {
      return res.status(404).json({ message: 'Utente non trovato' });
    }
    
    // Ottieni il file
    const file = db.prepare('SELECT * FROM user_files WHERE id = ? AND user_id = ?').get(fileId, userId) as UserFile | undefined;
    
    if (!file) {
      return res.status(404).json({ message: 'File non trovato' });
    }
    
    return res.json(file);
  } catch (error: any) {
    console.error('Errore durante il recupero del file:', error);
    return res.status(500).json({ 
      message: 'Errore durante il recupero del file', 
      error: error.message 
    });
  }
};

// Scarica un file specifico di un utente
export const downloadUserFile = async (req: Request, res: Response) => {
  try {
    const { userId, fileId } = req.params;
    
    // Verifica che l'utente esista
    const db = getDatabase();
    const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    
    if (!userExists) {
      return res.status(404).json({ message: 'Utente non trovato' });
    }
    
    // Ottieni il file
    const file = db.prepare('SELECT * FROM user_files WHERE id = ? AND user_id = ?').get(fileId, userId) as UserFile | undefined;
    
    if (!file) {
      return res.status(404).json({ message: 'File non trovato' });
    }
    
    // Verifica che il file esista sul disco
    if (!fs.existsSync(file.file_path)) {
      return res.status(404).json({ message: 'File non trovato sul disco' });
    }
    
    // Imposta gli header per il download
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
    res.setHeader('Content-Type', file.file_type);
    
    // Invia il file
    const fileStream = fs.createReadStream(file.file_path);
    fileStream.pipe(res);
  } catch (error: any) {
    console.error('Errore durante il download del file:', error);
    return res.status(500).json({ 
      message: 'Errore durante il download del file', 
      error: error.message 
    });
  }
};

// Elimina un file specifico di un utente
export const deleteUserFile = async (req: Request, res: Response) => {
  try {
    const { userId, fileId } = req.params;
    
    // Verifica che l'utente esista
    const db = getDatabase();
    const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    
    if (!userExists) {
      return res.status(404).json({ message: 'Utente non trovato' });
    }
    
    // Ottieni il file
    const file = db.prepare('SELECT * FROM user_files WHERE id = ? AND user_id = ?').get(fileId, userId) as UserFile | undefined;
    
    if (!file) {
      return res.status(404).json({ message: 'File non trovato' });
    }
    
    // Elimina il file dal disco
    if (fs.existsSync(file.file_path)) {
      fs.unlinkSync(file.file_path);
    }
    
    // Elimina il record dal database
    db.prepare('DELETE FROM user_files WHERE id = ?').run(fileId);
    
    return res.json({ message: 'File eliminato con successo', deletedFile: file });
  } catch (error: any) {
    console.error('Errore durante l\'eliminazione del file:', error);
    return res.status(500).json({ 
      message: 'Errore durante l\'eliminazione del file', 
      error: error.message 
    });
  }
};