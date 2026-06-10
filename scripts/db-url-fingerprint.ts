const { config } = require('dotenv');
const { getSafeDatabaseUrlInfo } = require('../lib/database-url-info');

config({ path: '.env', quiet: true });

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error('DATABASE_URL is missing from .env');
  process.exit(1);
}

console.log(JSON.stringify(getSafeDatabaseUrlInfo(databaseUrl), null, 2));
