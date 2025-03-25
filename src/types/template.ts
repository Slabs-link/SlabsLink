export interface Template {
  id: number;
  name: string;
  description: string | null;
  content: string;
  type: string;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}