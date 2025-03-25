import Database from 'better-sqlite3';
import crypto from 'crypto';
import readline from 'readline';
import fs from 'fs';

class LicenseGenerator {
    constructor() {
        // Initialize SQLite database connection
        this.db = new Database('licenses.db');
        this.db.pragma('journal_mode = WAL');
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
    createLicense(expirationDate, whatsappIntegration = false, googleCalendarIntegration = false) {
        const licenseKey = this.generateLicenseKey();
        const id = crypto.randomUUID();
        const stmt = this.db.prepare(`
            INSERT INTO licenses (id, key, expiration_date, features, active)
            VALUES (?, ?, ?, ?, ?)
        `);

        const features = JSON.stringify({
            whatsappIntegration,
            googleCalendarIntegration
        });

        const result = stmt.run(
            id,
            licenseKey,
            expirationDate,
            features,
            1 // active by default (SQLite uses 1/0 for boolean)
        );

        const insertedLicense = this.db.prepare('SELECT * FROM licenses WHERE id = ?').get(id);
        return {
            id: insertedLicense.id,
            key: insertedLicense.key,
            expirationDate: new Date(insertedLicense.expiration_date),
            features: JSON.parse(insertedLicense.features),
            active: Boolean(insertedLicense.active)
        };
    }

    // Check if the licenses table exists, create it if it doesn't
    ensureLicensesTableExists() {
        const tableExists = this.db.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='licenses'"
        ).get();

        if (!tableExists) {
            const createTableQuery = `
                CREATE TABLE licenses (
                    id TEXT PRIMARY KEY,
                    key TEXT UNIQUE NOT NULL,
                    expiration_date TEXT NOT NULL,
                    features TEXT NOT NULL,
                    active INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `;
            this.db.exec(createTableQuery);
            console.log('Created licenses table');
        }
    }

    // List all licenses
    listLicenses() {
        const stmt = this.db.prepare('SELECT * FROM licenses ORDER BY created_at DESC');
        const licenses = stmt.all();

        return licenses.map(row => ({
            id: row.id,
            key: row.key,
            expirationDate: new Date(row.expiration_date),
            features: JSON.parse(row.features),
            active: Boolean(row.active)
        }));
    }

    // Deactivate a license
    deactivateLicense(licenseKey) {
        const stmt = this.db.prepare(`
            UPDATE licenses
            SET active = 0
            WHERE key = ?
        `);

        const result = stmt.run(licenseKey);
        return result.changes > 0;
    }

    // Close the database connection
    close() {
        this.db.close();
    }
}

// Interactive CLI
async function runCLI() {
    const generator = new LicenseGenerator();
    generator.ensureLicensesTableExists();

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
                generateLicenseFlow();
                break;
            case '2':
                listLicensesFlow();
                break;
            case '3':
                deactivateLicenseFlow();
                break;
            case '4':
                generator.close();
                rl.close();
                console.log('Goodbye!');
                return;
            default:
                console.log('Invalid option, please try again.');
                displayMenu();
                return;
        }
    }

    function generateLicenseFlow() {
        rl.question('Enter expiration date (YYYY-MM-DD): ', (dateStr) => {
            const expirationDate = new Date(dateStr);
            if (isNaN(expirationDate.getTime())) {
                console.log('Invalid date format. Please use YYYY-MM-DD.');
                displayMenu();
                return;
            }

            rl.question('Include WhatsApp integration? (y/n): ', (whatsappAnswer) => {
                const whatsappIntegration = whatsappAnswer.toLowerCase() === 'y';

                rl.question('Include Google Calendar integration? (y/n): ', (googleAnswer) => {
                    const googleCalendarIntegration = googleAnswer.toLowerCase() === 'y';

                    try {
                        const license = generator.createLicense(
                            dateStr,
                            whatsappIntegration,
                            googleCalendarIntegration
                        );
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

    function listLicensesFlow() {
        try {
            const licenses = generator.listLicenses();
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
        displayMenu();
    }

    function deactivateLicenseFlow() {
        rl.question('Enter license key to deactivate: ', (licenseKey) => {
            try {
                const success = generator.deactivateLicense(licenseKey);
                if (success) {
                    console.log(`License ${licenseKey} has been deactivated.`);
                } else {
                    console.log(`License ${licenseKey} not found.`);
                }
            } catch (error) {
                console.error('Error deactivating license:', error);
            }
            displayMenu();
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