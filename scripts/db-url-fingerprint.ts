import { config as loadEnv } from 'dotenv';
import { getSafeDatabaseUrlInfo } from '../lib/database-url-info';

process.env.DOTENV_CONFIG_QUIET = 'true';
loadEnv({ path: '.env' });

const info = getSafeDatabaseUrlInfo(process.env.DATABASE_URL);

console.log(JSON.stringify(info, null, 2));

export {};
