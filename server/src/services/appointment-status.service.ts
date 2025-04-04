import { getDatabase } from '../config/database-sqlite';
import type { Database } from 'better-sqlite3';

/**
 * Servizio per la gestione dello stato degli appuntamenti
 * Si occupa di aggiornare automaticamente lo stato degli appuntamenti scaduti
 */
export class AppointmentStatusService {
  private db!: Database;

  constructor() {}

  /**
   * Funzione di logging per il servizio
   * @param level - Livello di log (info, warn, error)
   * @param message - Messaggio da loggare
   * @param data - Dati aggiuntivi opzionali
   */
  private log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const prefix = `[AppointmentStatusService][${timestamp}][${level.toUpperCase()}]`;
    
    if (data) {
      if (level === 'error') {
        console.error(`${prefix} ${message}`, data);
      } else if (level === 'warn') {
        console.warn(`${prefix} ${message}`, data);
      } else {
        console.log(`${prefix} ${message}`, data);
      }
    } else {
      if (level === 'error') {
        console.error(`${prefix} ${message}`);
      } else if (level === 'warn') {
        console.warn(`${prefix} ${message}`);
      } else {
        console.log(`${prefix} ${message}`);
      }
    }
  }

  /**
   * Verifica e aggiorna lo stato degli appuntamenti scaduti
   * Imposta lo stato 'completed' per gli appuntamenti con data/ora nel passato
   * @returns Numero di appuntamenti aggiornati
   */
  async updateExpiredAppointments(): Promise<number> {
    try {
      this.log('info', 'Verifica appuntamenti scaduti');
      this.db = getDatabase();
      
      if (!this.db) {
        this.log('error', 'Impossibile ottenere la connessione al database');
        return 0;
      }
      
      // Ottieni la data e ora corrente nel formato YYYY-MM-DD e HH:MM
      const now = new Date();
      const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const currentTime = now.toTimeString().substring(0, 5); // HH:MM
      
      // Aggiorna gli appuntamenti scaduti (con stato 'scheduled')
      // Un appuntamento è scaduto se:
      // 1. La data è precedente alla data corrente, oppure
      // 2. La data è uguale alla data corrente ma l'ora è precedente all'ora corrente
      const updateStmt = this.db.prepare(`
        UPDATE appointments 
        SET status = 'completed' 
        WHERE status = 'scheduled' AND (
          date < ? OR 
          (date = ? AND time < ?)
        )
      `);
      
      const result = updateStmt.run(currentDate, currentDate, currentTime);
      const updatedCount = result.changes;
      
      this.log('info', `Aggiornati ${updatedCount} appuntamenti scaduti a 'completed'`);
      return updatedCount;
    } catch (error) {
      this.log('error', 'Errore durante l\'aggiornamento degli appuntamenti scaduti', error);
      return 0;
    }
  }
}

// Esporta un'istanza singleton del servizio
export const appointmentStatusService = new AppointmentStatusService();