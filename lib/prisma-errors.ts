export type PrismaConnectivityCode =
  | 'DATABASE_CONNECTION_FAILED'
  | 'DATABASE_SCHEMA_NOT_READY'
  | 'DATABASE_URL_MISSING';

export type SafeDatabaseErrorDetails = {
  name: string | null;
  code: string | null;
  messageSafe: string | null;
  connectivityCode: PrismaConnectivityCode | null;
};

const PRISMA_CONNECTION_ERROR_CODES = new Set([
  'P1000',
  'P1001',
  'P1002',
  'P1003',
  'P1008',
  'P1009',
  'P1010',
  'P1011',
  'P1017',
]);

const PRISMA_SCHEMA_ERROR_CODES = new Set([
  'P2021',
  'P2022',
]);

function getErrorCode(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}

function sanitizeRawMessage(message: string) {
  const singleLine = message.replace(/\s+/g, ' ').trim();
  const redactedUrl = singleLine.replace(/postgres(?:ql)?:\/\/[^\s'"`]+/gi, '[redacted-database-url]');
  const redactedUser = redactedUrl
    .replace(/\b(for|user)\s+[`'"]?([a-z0-9._-]+)[`'"]?/gi, '$1 [redacted-user]')
    .replace(/\b(role|username)\s+[`'"]?([a-z0-9._-]+)[`'"]?/gi, '$1 [redacted-user]');

  return redactedUser.length > 180 ? `${redactedUser.slice(0, 177)}...` : redactedUser;
}

export function getPrismaConnectivityCode(error: unknown): PrismaConnectivityCode | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const message = error.message || '';
  const code = getErrorCode(error);

  if (code === 'P2021' || code === 'P2022') {
    return 'DATABASE_SCHEMA_NOT_READY';
  }

  if (code && PRISMA_CONNECTION_ERROR_CODES.has(code)) {
    return 'DATABASE_CONNECTION_FAILED';
  }

  if (error.name === 'PrismaClientInitializationError') {
    return 'DATABASE_CONNECTION_FAILED';
  }

  if (error.name === 'PrismaClientKnownRequestError') {
    if (
      message.includes('does not exist in the current database') ||
      message.includes('relation') && message.includes('does not exist') ||
      message.includes('table') && message.includes('does not exist')
    ) {
      return 'DATABASE_SCHEMA_NOT_READY';
    }
  }

  if (message.includes("Can't reach database server")) {
    return 'DATABASE_CONNECTION_FAILED';
  }

  if (message.includes('DATABASE_URL is not configured')) {
    return 'DATABASE_URL_MISSING';
  }

  if (
    message.includes('does not exist in the current database') ||
    (message.includes('relation') && message.includes('does not exist')) ||
    (message.includes('table') && message.includes('does not exist'))
  ) {
    return 'DATABASE_SCHEMA_NOT_READY';
  }

  return null;
}

export function getSafeDatabaseErrorDetails(error: unknown): SafeDatabaseErrorDetails {
  if (!(error instanceof Error)) {
    return {
      name: null,
      code: null,
      messageSafe: null,
      connectivityCode: null,
    };
  }

  const code = getErrorCode(error);
  const connectivityCode = getPrismaConnectivityCode(error);
  const message = error.message || '';

  let messageSafe: string | null = null;

  switch (code) {
    case 'P1000':
      messageSafe = 'Database authentication failed.';
      break;
    case 'P1001':
      messageSafe = 'Cannot reach the database server.';
      break;
    case 'P1003':
      messageSafe = 'The configured database does not exist.';
      break;
    case 'P1011':
      messageSafe = 'Database TLS or SSL negotiation failed.';
      break;
    case 'P1017':
      messageSafe = 'Database connection was closed by the server.';
      break;
    case 'P1010':
      messageSafe = 'Database access was denied for this connection.';
      break;
    case 'P2021':
      messageSafe = 'A required database table does not exist.';
      break;
    case 'P2022':
      messageSafe = 'A required database column does not exist.';
      break;
    default:
      if (connectivityCode === 'DATABASE_URL_MISSING') {
        messageSafe = 'DATABASE_URL is not configured on the server.';
      } else if (connectivityCode === 'DATABASE_SCHEMA_NOT_READY') {
        messageSafe = 'A required database table does not exist on the target database.';
      } else if (connectivityCode === 'DATABASE_CONNECTION_FAILED') {
        messageSafe = 'Database connection failed.';
      } else if (error.name.startsWith('Prisma')) {
        messageSafe = sanitizeRawMessage(message) || 'Prisma request failed.';
      }
  }

  return {
    name: error.name || null,
    code,
    messageSafe,
    connectivityCode,
  };
}

export function logSafeDatabaseError(context: string, error: unknown) {
  const details = getSafeDatabaseErrorDetails(error);

  console.error(`[${context}]`, {
    name: details.name,
    code: details.code,
    connectivityCode: details.connectivityCode,
    message: details.messageSafe,
  });
}

export function getPrismaConnectivityMessage(error: unknown): string | null {
  const details = getSafeDatabaseErrorDetails(error);
  const code = details.connectivityCode;

  if (!code) {
    return null;
  }

  switch (code) {
    case 'DATABASE_CONNECTION_FAILED':
      if (details.code === 'P1000') {
        return 'Database unavailable. Authentication to the database failed. Check the server DATABASE_URL credentials.';
      }
      if (details.code === 'P1001') {
        return 'Database unavailable. The running server cannot reach the database host.';
      }
      if (details.code === 'P1003') {
        return 'Database unavailable. The configured database does not exist on the database server.';
      }
      return 'Database unavailable. Check DATABASE_URL and make sure your Postgres host is reachable from the running server.';
    case 'DATABASE_SCHEMA_NOT_READY':
      return 'Database schema is not ready. Run Prisma migrations against the target database before using this deployment.';
    case 'DATABASE_URL_MISSING':
      return 'Database unavailable. DATABASE_URL is not configured on the server.';
    default:
      return null;
  }
}
