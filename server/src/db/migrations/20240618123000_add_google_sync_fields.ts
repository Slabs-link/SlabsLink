import { Migration } from './migration';

export default class AddGoogleSyncFields extends Migration {
  declare db: Migration['db'];

  name = 'add_google_sync_fields';

  async up() {
    await this.db.exec(`
      ALTER TABLE appointments
      ADD COLUMN google_event_id TEXT;
      
      ALTER TABLE appointments
      ADD COLUMN sync_status TEXT CHECK(sync_status IN ('synced', 'pending', 'failed')) DEFAULT 'pending';
    `);
  }

  async down() {
    await this.db.exec(`
      ALTER TABLE appointments
      DROP COLUMN google_event_id;
      
      ALTER TABLE appointments
      DROP COLUMN sync_status;
    `);
  }
}