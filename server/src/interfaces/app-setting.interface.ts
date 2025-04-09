export interface AppSetting {
  key: string;
  value: string;
  created_at?: string;
  updated_at?: string;
}

export interface CalendarSettings {
  googleCalendarEnabled: boolean;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokens?: {
    access_token: string;
    refresh_token?: string;
    expiry_date?: number;
    token_type?: string;
    id_token?: string;
    scope?: string;
  };
  channelId?: string;
  resourceId?: string;
  expiration?: string | number;
  selectedCalendarId?: string; // Mantenuto per retrocompatibilità
  selectedCalendarIds?: string[]; // Nuovo campo per supportare selezione multipla
  availableCalendars?: Array<{id: string, summary: string}>;
  lastSyncFromGoogle?: string;
  lastSyncStats?: {
    importati: number;
    aggiornati: number;
    saltati: number;
    totale: number;
  };
};