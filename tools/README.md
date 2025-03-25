# SlabsLink License Generator

This tool allows you to generate and manage license keys for the SlabsLink application.

## Features

- Generate new license keys with configurable expiration dates
- Enable/disable WhatsApp integration feature
- Enable/disable Google Calendar integration feature
- List all existing licenses
- Deactivate licenses
- Automatically creates the licenses table if it doesn't exist

## Prerequisites

- Node.js and npm installed
- PostgreSQL database (same as used by the main SlabsLink application)

## Usage

### Setup

Make sure you have the required dependencies installed:

```bash
npm install pg typescript ts-node @types/node
```

### Running the License Generator

You can run the license generator using ts-node:

```bash
ts-node license-generator.ts
```

Or compile it first with TypeScript and then run it:

```bash
tsc license-generator.ts
node license-generator.js
```

### Environment Variables

The tool uses the following environment variables for database connection:

- `DB_HOST`: Database host (default: 'localhost')
- `DB_PORT`: Database port (default: '5432')
- `DB_NAME`: Database name (default: 'slabslink')
- `DB_USER`: Database user (default: 'postgres')
- `DB_PASSWORD`: Database password (default: 'postgres')

You can set these variables before running the tool or modify the defaults in the code.

### Interactive Menu

The tool provides an interactive command-line interface with the following options:

1. **Generate new license** - Create a new license key with specified expiration date and features
2. **List all licenses** - View all existing licenses in the database
3. **Deactivate a license** - Disable an existing license by its key
4. **Exit** - Close the application

### License Files

When generating a new license, the tool will save the license information to a JSON file named `license-[KEY].json` in the current directory. This file can be distributed to users for activation.