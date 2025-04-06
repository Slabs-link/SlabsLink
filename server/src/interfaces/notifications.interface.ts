export interface Template {
  id: number;
  content: string;
  type?: string;
}

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  phone?: string;
}

export interface Appointment {
  id: number;
  patient_id: number;
  appointment_date: string;
  appointment_time: string;
  date?: string; // Alias per appointment_date
  time?: string; // Alias per appointment_time
  title?: string; // Titolo dell'appuntamento
}

export interface Notification {
  id: number;
  user_id: number;
  message: string;
  status: string;
  template_id?: number;
  appointment_id?: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
}