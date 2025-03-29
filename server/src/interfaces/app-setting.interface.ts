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
  tokens?: any;
  channelId?: string;
  resourceId?: string;
  expiration?: string | number;
  selectedCalendarId?: string;
  availableCalendars?: Array<{id: string, summary: string}>;
  workingHours?: {
    mondayStart: string;
    mondayEnd: string;
    tuesdayStart: string;
    tuesdayEnd: string;
    wednesdayStart: string;
    wednesdayEnd: string;
    thursdayStart: string;
    thursdayEnd: string;
    fridayStart: string;
    fridayEnd: string;
    saturdayStart: string;
    saturdayEnd: string;
    sundayStart: string;
    sundayEnd: string;
  };
}