import { Client } from 'pg';
import { getSafeDatabaseUrlInfo } from '@/lib/database-url-info';
import { successResponse, errorResponse } from '@/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return errorResponse('DATABASE_URL is not configured.', 400, 'DATABASE_URL_MISSING');
  }

  const urlInfo = getSafeDatabaseUrlInfo(databaseUrl);

  const connectionOptions: any = {
    connectionString: databaseUrl,
  };

  if (urlInfo.hasSslModeRequire || urlInfo.isNeonPoolerHost || databaseUrl.includes('sslmode=require')) {
    connectionOptions.ssl = {
      rejectUnauthorized: false,
    };
  }

  const client = new Client(connectionOptions);

  try {
    await client.connect();

    const selectOneResult = await client.query('SELECT 1 as ok');
    const selectOneOk = selectOneResult.rows[0]?.ok === 1;

    const dbIdentityResult = await client.query('SELECT current_database() as current_database, current_schema() as current_schema');
    const currentDatabase = dbIdentityResult.rows[0]?.current_database || null;
    const currentSchema = dbIdentityResult.rows[0]?.current_schema || null;

    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = current_schema() 
        AND table_name IN ('users', 'guest_sessions', 'carts')
    `);

    const existingTables = tablesResult.rows.map((r: any) => r.table_name);
    const tablesExist = {
      users: existingTables.includes('users'),
      guest_sessions: existingTables.includes('guest_sessions'),
      carts: existingTables.includes('carts'),
    };

    await client.end();

    return successResponse({
      connection: 'ok',
      selectOneOk,
      dbIdentity: {
        currentDatabase,
        currentSchema,
      },
      tablesExist,
      dbUrlInfo: urlInfo,
    });
  } catch (error: any) {
    try {
      await client.end();
    } catch {}

    const rawMessage = error?.message || 'Unknown error';
    const singleLine = rawMessage.replace(/\s+/g, ' ').trim();
    const redactedUrl = singleLine.replace(/postgres(?:ql)?:\/\/[^\s'"`]+/gi, '[redacted-database-url]');
    const redactedUser = redactedUrl
      .replace(/\b(for|user)\s+[`'"]?([a-z0-9._-]+)[`'"]?/gi, '$1 [redacted-user]')
      .replace(/\b(role|username)\s+[`'"]?([a-z0-9._-]+)[`'"]?/gi, '$1 [redacted-user]');
    const redactedSecrets = redactedUser
      .replace(/\b(password|secret|token|key|deviceSecret)\b\s*[:=]\s*[^,\s)]+/gi, '$1=[redacted]')
      .replace(/\b(auth|credential)s?\b\s*[:=]\s*[^,\s)]+/gi, '$1=[redacted]');

    return errorResponse(redactedSecrets, 500, 'RAW_DATABASE_CONNECTION_FAILED');
  }
}
