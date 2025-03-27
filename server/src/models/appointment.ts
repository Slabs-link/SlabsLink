export interface Appointment {
  id: number;
  start_time: string;
  end_time: string;
  patient_id: number;
  notes?: string;
  google_event_id?: string;
  sync_status?: 'synced' | 'pending' | 'failed';
}