import { Pool } from 'pg';

export interface License {
  id: string;
  key: string;
  expirationDate: Date;
  features: {
    whatsappIntegration: boolean;
    googleCalendarIntegration: boolean;
  };
  active: boolean;
}

export class LicenseModel {
  constructor(private pool: Pool) {}

  async validate(key: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT * FROM licenses 
      WHERE key = ? 
      AND expiration_date > CURRENT_DATE
      AND active = 1`,
      [key]
    );
    return result.rows.length > 0;
  }

  async getLicense(key: string): Promise<License | null> {
    const result = await this.pool.query(
      'SELECT * FROM licenses WHERE key = ?',
      [key]
    );
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToLicense(result.rows[0]);
  }

  async hasWhatsAppIntegration(): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT JSON_EXTRACT(features, '$.whatsappIntegration') as has_whatsapp 
      FROM licenses 
      WHERE active = 1 
      AND expiration_date > CURRENT_DATE`
    );
    return result.rows.length > 0 && result.rows[0].has_whatsapp === 1;
  }

  async hasGoogleCalendarIntegration(): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT JSON_EXTRACT(features, '$.googleCalendarIntegration') as has_calendar 
      FROM licenses 
      WHERE active = 1 
      AND expiration_date > CURRENT_DATE`
    );
    return result.rows.length > 0 && result.rows[0].has_calendar === 1;
  }

  private mapRowToLicense(row: any): License {
    return {
      id: row.id,
      key: row.key,
      expirationDate: row.expiration_date,
      features: {
        whatsappIntegration: row.features.whatsappIntegration,
        googleCalendarIntegration: row.features.googleCalendarIntegration
      },
      active: row.active
    };
  }
}