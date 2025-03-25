import { Pool } from 'pg';
import crypto from 'crypto';
import readline from 'readline';
import fs from 'fs';

class LicenseGenerator {
    constructor() {
        // Initialize database connection
        this.pool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'slabslink',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres'
        });
    }

    // Generate a random license key
    generateLicenseKey() {
        const keyParts = [];
        // Generate 4 groups of 5 alphanumeric characters
        for (let i = 0; i < 4; i++) {
            const part = crypto.randomBytes(5).toString('hex').toUpperCase().substring(0, 5);
            keyParts.push(part);
        }
        // Join with hyphens: XXXXX-XXXXX-XXXXX-XXXXX
        return keyParts.join('-');
    }

    // Create a new license in the database
    async createLicense(expirationDate, whatsappIntegration = false, googleCalendarIntegration = false) {
        const licenseKey = this.generateLicenseKey();
        const id = crypto.randomUUID();
        const query = `
      INSERT INTO licenses (id, key, expiration_date, features, active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

        const features = {
            whatsappIntegration,
            googleCalendarIntegration
        };

        const result = await this.pool.query(query, [
            id,
            licenseKey,
            expirationDate,
            features,
            true // active by default
        ]);

        return {
            id: result.rows[0].id,
            key: result.rows[0].key,
            expirationDate: result.rows[0].expiration_date,
            features: result.rows[0].features,
            active: result.rows[0].active
        };
    }

    // Check if the licenses table exists, create it if it doesn't
    async ensureLicensesTableExists() {
        const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'licenses'
      );
    `;

        const result = await this.pool.query(tableExistsQuery);
        const tableExists = result.rows[0].exists;

        if (!tableExists) {
            const createTableQuery = `
        CREATE TABLE licenses (
          id UUID PRIMARY KEY,
          key VARCHAR(23) UNIQUE NOT NULL,
          expiration_date DATE NOT NULL,
          features JSONB NOT NULL,
          active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
            await this.pool.query(createTableQuery);
            console.log('Created licenses table');
        }
    }

    // List all licenses
    async listLicenses() {
        const query = 'SELECT * FROM licenses ORDER BY created_at DESC';
        const result = await this.pool.query(query);

        return result.rows.map(row => ({
            id: row.id,
            key: row.key,
            expirationDate: row.expiration_date,
            features: row.features,
            active: row.active
        }));
    }

    // Deactivate a license
    async deactivateLicense(licenseKey) {
        const query = `
      UPDATE licenses
      SET active = false
      WHERE key = $1
      RETURNING *
    `;

        const result = await this.pool.query(query, [licenseKey]);
        return result.rowCount > 0;
    }

    // Close the database connection
    async close() {
        await this.pool.end();
    }
}

// Interactive CLI
async function runCLI() {
    const generator = new LicenseGenerator();
    await generator.ensureLicensesTableExists();

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    function displayMenu() {
        console.log('\nSlabsLink License Generator');
        console.log('===========================');
        console.log('1. Generate new license');
        console.log('2. List all licenses');
        console.log('3. Deactivate a license');
        console.log('4. Exit');
        rl.question('\nSelect an option: ', handleMenuChoice);
    }

    async function handleMenuChoice(choice) {
        switch (choice) {
            case '1':
                await generateLicenseFlow();
                break;
            case '2':
                await listLicensesFlow();
                break;
            case '3':
                await deactivateLicenseFlow();
                break;
            case '4':
                await generator.close();
                rl.close();
                console.log('Goodbye!');
                return;
            default:
                console.log('Invalid option, please try again.');
                displayMenu();
                return;
        }
        displayMenu();
    }

    async function generateLicenseFlow() {
        rl.question('Enter expiration date (YYYY-MM-DD): ', async (dateStr) => {
            const expirationDate = new Date(dateStr);
            if (isNaN(expirationDate.getTime())) {
                console.log('Invalid date format. Please use YYYY-MM-DD.');
                displayMenu();
                return;
            }

            rl.question('Include WhatsApp integration? (y/n): ', async (whatsappAnswer) => {
                const whatsappIntegration = whatsappAnswer.toLowerCase() === 'y';

                rl.question('Include Google Calendar integration? (y/n): ', async (googleAnswer) => {
                    const googleCalendarIntegration = googleAnswer.toLowerCase() === 'y';

                    try {
                        const license = await generator.createLicense(expirationDate, whatsappIntegration, googleCalendarIntegration);
                        console.log('\nLicense generated successfully:');
                        console.log(`License Key: ${license.key}`);
                        console.log(`Expiration Date: ${license.expirationDate.toISOString().split('T')[0]}`);
                        console.log(`Features: WhatsApp (${license.features.whatsappIntegration ? 'Yes' : 'No'}), Google Calendar (${license.features.googleCalendarIntegration ? 'Yes' : 'No'})`);

                        const licenseInfo = {
                            key: license.key,
                            expirationDate: license.expirationDate.toISOString().split('T')[0],
                            features: license.features
                        };

                        const fileName = `license-${license.key}.json`;
                        fs.writeFileSync(fileName, JSON.stringify(licenseInfo, null, 2));
                        console.log(`License information saved to ${fileName}`);
                        displayMenu();
                    } catch (error) {
                        console.error('Error generating license:', error);
                        displayMenu();
                    }
                });
            });
        });
    }

    async function listLicensesFlow() {
        try {
            const licenses = await generator.listLicenses();
            if (licenses.length === 0) {
                console.log('No licenses found.');
            } else {
                console.log('\nAll Licenses:');
                licenses.forEach((license, index) => {
                    console.log(`\n${index + 1}. License Key: ${license.key}`);
                    console.log(`   Expiration: ${license.expirationDate.toISOString().split('T')[0]}`);
                    console.log(`   Features: WhatsApp (${license.features.whatsappIntegration ? 'Yes' : 'No'}), Google Calendar (${license.features.googleCalendarIntegration ? 'Yes' : 'No'})`);
                    console.log(`   Status: ${license.active ? 'Active' : 'Inactive'}`);
                });
            }
        } catch (error) {
            console.error('Error listing licenses:', error);
        }
    }

    async function deactivateLicenseFlow() {
        rl.question('Enter license key to deactivate: ', async (licenseKey) => {
            try {
                const success = await generator.deactivateLicense(licenseKey);
                if (success) {
                    console.log(`License ${licenseKey} has been deactivated.`);
                } else {
                    console.log(`License ${licenseKey} not found.`);
                }
            } catch (error) {
                console.error('Error deactivating license:', error);
            }
        });
    }

    // Start the CLI
    displayMenu();
}

// Run the CLI
runCLI().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
