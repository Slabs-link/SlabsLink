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
      WHERE key = $1 
      AND expiration_date > CURRENT_DATE 
      AND active = true`,
      [key]
    );
    return result.rows.length > 0;
  }

  async getLicense(key: string): Promise<License | null> {
    const result = await this.pool.query(
      'SELECT * FROM licenses WHERE key = $1',
      [key]
    );
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToLicense(result.rows[0]);
  }

  async hasWhatsAppIntegration(): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT features->>'whatsappIntegration' as has_whatsapp 
      FROM licenses 
      WHERE active = true 
      AND expiration_date > CURRENT_DATE`
    );
    return result.rows.length > 0 && result.rows[0].has_whatsapp === 'true';
  }

  async hasGoogleCalendarIntegration(): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT features->>'googleCalendarIntegration' as has_calendar 
      FROM licenses 
      WHERE active = true 
      AND expiration_date > CURRENT_DATE`
    );
    return result.rows.length > 0 && result.rows[0].has_calendar === 'true';
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