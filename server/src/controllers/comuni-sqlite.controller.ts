import { Request, Response } from 'express';
import { getDatabase } from '../config/database-sqlite';
import path from 'path';
import fs from 'fs';

// Remove the duplicate path import and add the debug logs
console.log('Comuni controller loaded');
console.log('Database path:', path.resolve(__dirname, '../data/comuni.db'));

// Get all comuni
export const getAllComuni = async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const search = req.query.search as string;
    
    // Se è presente un parametro di ricerca, filtra i risultati
    if (search && search.trim()) {
      const searchQuery = `%${search.toString().toLowerCase()}%`;
      const comuni = db.prepare(
        'SELECT * FROM comuni WHERE LOWER(nome) LIKE ? OR LOWER(provincia) LIKE ? ORDER BY nome LIMIT 100'
      ).all(searchQuery, searchQuery);
      
      return res.json(comuni);
    }
    
    // Altrimenti restituisci tutti i comuni (limitati a 100 per performance)
    const comuni = db.prepare('SELECT * FROM comuni ORDER BY nome LIMIT 100').all();
    return res.json(comuni);
  } catch (error: any) {
    console.error('Error getting comuni:', error);
    return res.status(500).json({ 
      message: 'Error retrieving comuni', 
      error: error.message 
    });
  }
};

// Search comuni by name
export const searchComuniByName = async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    const db = getDatabase();
    const searchQuery = `%${query.toString().toLowerCase()}%`;
    const comuni = db.prepare(
      'SELECT * FROM comuni WHERE LOWER(nome) LIKE ? ORDER BY nome LIMIT 20'
    ).all(searchQuery);
    
    return res.json(comuni);
  } catch (error: any) {
    console.error('Error searching comuni:', error);
    return res.status(500).json({ 
      message: 'Error searching comuni', 
      error: error.message 
    });
  }
};

// Get comune by code
export const getComuneByCode = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const db = getDatabase();
    
    const comune = db.prepare('SELECT * FROM comuni WHERE codice = ?').get(code);
    
    if (!comune) {
      return res.status(404).json({ message: 'Comune not found' });
    }
    
    return res.json(comune);
  } catch (error: any) {
    console.error('Error getting comune:', error);
    return res.status(500).json({ 
      message: 'Error retrieving comune', 
      error: error.message 
    });
  }
};

// Initialize comuni table with data
export const initializeComuniTable = async () => {
  try {
    const db = getDatabase();
    
    // Verifica se la tabella comuni esiste
    db.prepare(`
      CREATE TABLE IF NOT EXISTS comuni (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        provincia TEXT NOT NULL,
        regione TEXT,
        codice TEXT UNIQUE NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `).run();
    
    // Cerca il file comuni.json in diverse posizioni
    const possiblePaths = [
      path.join(process.cwd(), 'data', 'comuni.json'),
      path.join(process.cwd(), 'server', 'data', 'comuni.json'),
      path.join(__dirname, '..', 'data', 'comuni.json'),
      path.join(__dirname, '..', '..', 'data', 'comuni.json')
    ];
    
    let comuniPath = null;
    for (const p of possiblePaths) {
      console.log(`Checking for comuni.json at: ${p}`);
      if (fs.existsSync(p)) {
        comuniPath = p;
        console.log(`Found comuni.json at: ${p}`);
        break;
      }
    }
    
    if (!comuniPath) {
      console.error('Comuni data file not found in any of the expected locations');
      return;
    }
    
    // Verifica se ci sono già dati nella tabella comuni
    const existingCount = db.prepare('SELECT COUNT(*) as count FROM comuni').get() as { count: number };
    if (existingCount.count > 0) {
      console.log(`Comuni table already contains ${existingCount.count} records, skipping initialization`);
      return;
    }
    
    const comuniData = fs.readFileSync(comuniPath, 'utf8');
    const comuni = JSON.parse(comuniData);
    
    const insertComune = db.prepare(
      'INSERT OR REPLACE INTO comuni (nome, provincia, regione, codice) VALUES (?, ?, ?, ?)'
    );
    
    db.transaction(() => {
      for (const comune of comuni) {
        insertComune.run(comune.nome, comune.provincia, comune.regione || null, comune.codice);
      }
    })();
    
    console.log(`Comuni table initialized successfully with ${comuni.length} records`);
  } catch (error) {
    console.error('Error initializing comuni table:', error);
  }
};

// Aggiungiamo un endpoint specifico per la ricerca dei comuni per il form utente
export const searchComuniForUserForm = async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    
    const db = getDatabase();
    
    // Se è presente un parametro di ricerca, filtra i risultati
    if (query && query.toString().trim()) {
      const searchQuery = `%${query.toString().toLowerCase()}%`;
      const comuni = db.prepare(
        'SELECT * FROM comuni WHERE LOWER(nome) LIKE ? ORDER BY nome LIMIT 20'
      ).all(searchQuery);
      
      return res.json(comuni);
    }
    
    // Altrimenti restituisci i comuni più popolosi (limitati a 20 per performance)
    const comuni = db.prepare('SELECT * FROM comuni ORDER BY nome LIMIT 20').all();
    return res.json(comuni);
  } catch (error: any) {
    console.error('Error searching comuni for user form:', error);
    return res.status(500).json({ 
      message: 'Error searching comuni', 
      error: error.message 
    });
  }
};