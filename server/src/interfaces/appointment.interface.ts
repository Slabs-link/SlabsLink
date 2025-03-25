export interface Appointment {
  id: number;
  patient_id?: number;
  patient_name: string;
  date: string;
  time: string;
  notes?: string;
  google_calendar_event_id?: string | null;
  synced?: number | boolean;
  notification_sent?: number | boolean;
  status?: string;
  appointment_type_id?: number | null;
  appointment_type_name?: string;
  created_at?: string;
  updated_at?: string;
  user_id?: number;
  title?: string;
  appointment_date?: string;
  appointment_time?: string;
  duration?: number;
  first_name?: string;
  last_name?: string;
}