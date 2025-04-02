import crypto from 'crypto';

/**
 * Utility per la crittografia e decrittografia dei dati della licenza
 */

// Chiave segreta per la crittografia (in un'applicazione reale, questa dovrebbe essere memorizzata in modo sicuro)
// Ad esempio in una variabile d'ambiente o in un vault sicuro
const SECRET_KEY = 'slabslink-license-encryption-key-2024';
const IV_LENGTH = 16; // Per AES, la lunghezza dell'IV è sempre 16 byte
const ALGORITHM = 'aes-256-cbc';

/**
 * Crittografa un oggetto JSON
 * @param data Oggetto da crittografare
 * @returns Stringa crittografata in formato base64
 */
export function encryptData(data: any): string {
  try {
    // Converti l'oggetto in una stringa JSON
    const jsonString = JSON.stringify(data);
    
    // Genera un IV casuale
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Crea una chiave derivata dalla chiave segreta usando SHA-256
    const key = crypto.createHash('sha256').update(SECRET_KEY).digest();
    
    // Crea il cipher con l'algoritmo AES-256-CBC
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Crittografa i dati
    let encrypted = cipher.update(jsonString, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Combina IV e dati crittografati in un'unica stringa
    // L'IV deve essere incluso per poter decrittografare i dati
    const result = iv.toString('base64') + ':' + encrypted;
    
    return result;
  } catch (error) {
    console.error('Errore durante la crittografia dei dati:', error);
    throw new Error('Impossibile crittografare i dati della licenza');
  }
}

/**
 * Decrittografa una stringa crittografata in un oggetto JSON
 * @param encryptedData Stringa crittografata in formato base64
 * @returns Oggetto JSON decrittografato
 */
export function decryptData(encryptedData: string): any {
  try {
    // Separa l'IV dai dati crittografati
    const parts = encryptedData.split(':');
    
    if (parts.length !== 2) {
      throw new Error('Formato dati crittografati non valido');
    }
    
    const iv = Buffer.from(parts[0], 'base64');
    const encrypted = parts[1];
    
    // Crea una chiave derivata dalla chiave segreta usando SHA-256
    const key = crypto.createHash('sha256').update(SECRET_KEY).digest();
    
    // Crea il decipher con l'algoritmo AES-256-CBC
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    // Decrittografa i dati
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Converti la stringa JSON in un oggetto
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Errore durante la decrittografia dei dati:', error);
    throw new Error('Impossibile decrittografare i dati della licenza. Il file potrebbe essere danneggiato o manomesso.');
  }
}

/**
 * Verifica se una stringa è crittografata
 * @param data Stringa da verificare
 * @returns true se la stringa sembra essere crittografata, false altrimenti
 */
export function isEncrypted(data: string): boolean {
  // Verifica se la stringa ha il formato di dati crittografati (IV:encrypted)
  const parts = data.split(':');
  
  if (parts.length !== 2) {
    return false;
  }
  
  // Verifica se la prima parte è un IV valido in base64
  try {
    const iv = Buffer.from(parts[0], 'base64');
    return iv.length === IV_LENGTH;
  } catch {
    return false;
  }
}