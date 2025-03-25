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
  appointment_date: string;
  appointment_time: string;
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