export interface CalendarSettings {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokens?: {
    access_token: string;
    refresh_token: string;
    expiry_date: number;
    token_type: string;
    id_token?: string;
    scope?: string;
  };
  channelId?: string;
  resourceId?: string;
  expiration?: string;
}