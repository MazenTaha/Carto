import { successResponse } from '@/lib/api-response';
import { getAppRuntimeEnvironment, getSafeDatabaseUrlInfo } from '@/lib/database-url-info';
import { getAdminEmails, isAdminEmail } from '@/lib/admin-emails';
import { GUEST_SESSION_COOKIE, GUEST_SESSION_MAX_AGE } from '@/lib/guest-session.constants';
import { prisma } from '@/lib/prisma';
import { getSafeDatabaseErrorDetails, logSafeDatabaseError } from '@/lib/prisma-errors';
import type { DemoAuthReadiness } from '@/types/auth-readiness';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

const DEMO_ADMIN_EMAIL = 'admin@gmail.com';

function setNoStoreHeaders(response: Response) {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}

function hasConfiguredGoogleAuth() {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

function hasConfiguredFirebaseClient() {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() &&
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() &&
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim()
  );
}

function hasConfiguredFirebaseAdmin() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID?.trim() &&
    process.env.FIREBASE_CLIENT_EMAIL?.trim() &&
    process.env.FIREBASE_PRIVATE_KEY?.trim()
  );
}

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null;

  let cleaned = value.trim().toLowerCase().replace(/\/+$/, '');

  try {
    return new URL(cleaned).origin.replace(/\/+$/, '');
  } catch {
    return cleaned;
  }
}

function buildWarnings(data: DemoAuthReadiness) {
  const warnings: string[] = [];

  if (!data.database.hasDatabaseUrl) {
    warnings.push('DATABASE_URL_MISSING');
  }

  if (!data.auth.hasNextAuthUrl) {
    warnings.push('NEXTAUTH_URL_MISSING');
  } else if (!data.auth.nextAuthUrlMatchesDeployment) {
    warnings.push('NEXTAUTH_URL_MISMATCH');
  }

  if (!data.auth.hasNextAuthSecret) {
    warnings.push('NEXTAUTH_SECRET_MISSING');
  }

  if (!data.auth.hasAuthSecret) {
    warnings.push('AUTH_SECRET_MISSING');
  }

  if (!data.auth.adminEmailsConfigured) {
    warnings.push('ADMIN_EMAILS_MISSING');
  }

  if (!data.auth.adminAccessConfigured) {
    warnings.push('ADMIN_EMAIL_NOT_ALLOWED');
  }

  if (data.database.connection === 'ok' && data.database.userTableReachable && !data.auth.adminUserExists) {
    warnings.push('ADMIN_USER_MISSING_IN_PRODUCTION_DB');
  }

  if (data.auth.adminUserExists && !data.auth.adminHasPasswordHash) {
    warnings.push('ADMIN_PASSWORD_HASH_MISSING');
  }

  if (!data.database.guestSessionTableReachable && data.database.connection === 'ok') {
    warnings.push('GUEST_SESSION_TABLE_MISSING');
  }

  if (!data.auth.googleConfigured) {
    warnings.push('GOOGLE_AUTH_NOT_CONFIGURED');
  }

  if (!data.auth.firebaseClientConfigured) {
    warnings.push('FIREBASE_CLIENT_CONFIG_MISSING');
  }

  if (!data.auth.firebaseAdminConfigured) {
    warnings.push('FIREBASE_ADMIN_CONFIG_MISSING');
  }

  return warnings;
}

function applyDatabaseError(data: DemoAuthReadiness, error: unknown, warningTarget: string[]) {
  const safeError = getSafeDatabaseErrorDetails(error);

  data.database.connection = 'error';
  data.database.prismaErrorCode = safeError.code;
  data.database.prismaErrorName = safeError.name;
  data.database.prismaErrorMessageSafe = safeError.messageSafe;

  if (safeError.connectivityCode === 'DATABASE_SCHEMA_NOT_READY') {
    warningTarget.push('DATABASE_SCHEMA_NOT_READY');
  } else if (safeError.connectivityCode === 'DATABASE_URL_MISSING') {
    warningTarget.push('DATABASE_URL_MISSING');
  } else {
    warningTarget.push('DATABASE_CONNECTION_FAILED');
  }
}

export async function GET(request: Request) {
  const runtimeEnvironment = getAppRuntimeEnvironment();
  const nodeEnv = process.env.NODE_ENV || 'development';
  const deploymentOrigin = new URL(request.url).origin;
  const configuredNextAuthOrigin = normalizeOrigin(process.env.NEXTAUTH_URL);
  const normalizedDeploymentOrigin = normalizeOrigin(deploymentOrigin);
  const hasNextAuthSecret = Boolean(process.env.NEXTAUTH_SECRET?.trim());
  const hasAuthSecret = Boolean(process.env.AUTH_SECRET?.trim());
  const hasAnyAuthSecret = hasNextAuthSecret || hasAuthSecret;
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const adminEmails = getAdminEmails();
  const googleConfigured = hasConfiguredGoogleAuth();
  const firebaseClientConfigured = hasConfiguredFirebaseClient();
  const firebaseAdminConfigured = hasConfiguredFirebaseAdmin();

  const data: DemoAuthReadiness = {
    runtime: runtimeEnvironment,
    database: {
      hasDatabaseUrl,
      connection: hasDatabaseUrl ? 'ok' : 'missing',
      prismaErrorCode: null,
      prismaErrorName: null,
      prismaErrorMessageSafe: null,
      runtime: runtimeEnvironment,
      nodeEnv,
      dbUrlInfo: getSafeDatabaseUrlInfo(),
      userTableReachable: false,
      guestSessionTableReachable: false,
      rawConnectionOk: false,
      currentDatabase: null,
      currentSchema: null,
      tablesExist: {
        users: false,
        guest_sessions: false,
        carts: false,
      },
      prismaModelChecks: {
        userModelOk: false,
        guestSessionModelOk: false,
        cartModelOk: false,
      },
    },
    auth: {
      hasNextAuthUrl: Boolean(configuredNextAuthOrigin),
      nextAuthUrlMatchesDeployment: configuredNextAuthOrigin === normalizedDeploymentOrigin,
      hasNextAuthSecret,
      hasAuthSecret,
      hasAnyAuthSecret,
      adminEmailsConfigured: adminEmails.length > 0,
      adminUserExists: false,
      adminUserEmail: DEMO_ADMIN_EMAIL,
      adminHasPasswordHash: false,
      adminPasswordFieldUsed: 'password',
      adminAccessConfigured: isAdminEmail(DEMO_ADMIN_EMAIL),
      googleConfigured,
      firebaseClientConfigured,
      firebaseAdminConfigured,
      providers: {
        credentials: false,
        guest: false,
        google: false,
        phone: false,
      },
    },
    guest: {
      guestRoute: '/api/auth/guest',
      guestSessionModelReachable: false,
      cookieName: GUEST_SESSION_COOKIE,
      cookieOptions: {
        path: '/',
        sameSite: 'lax',
        httpOnly: true,
        secureInProduction: true,
        maxAgeSeconds: GUEST_SESSION_MAX_AGE,
      },
    },
    warnings: [],
  };

  if (hasDatabaseUrl) {
    // 1. Direct Raw Connection check
    try {
      const rawRes = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
      if (rawRes && rawRes[0]?.ok === 1) {
        data.database.rawConnectionOk = true;
      }
    } catch (error) {
      logSafeDatabaseError('demo/auth-readiness raw-connection-check', error);
      applyDatabaseError(data, error, data.warnings);
    }

    if (data.database.connection !== 'error') {
      // 2. Current DB identity
      try {
        const identity = await prisma.$queryRaw<Array<{ current_database: string; current_schema: string }>>`
          SELECT current_database() as current_database, current_schema() as current_schema
        `;
        if (identity && identity[0]) {
          data.database.currentDatabase = identity[0].current_database;
          data.database.currentSchema = identity[0].current_schema;
        }
      } catch (error) {
        logSafeDatabaseError('demo/auth-readiness db-identity', error);
      }

      // 3. Table existence check
      try {
        const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = current_schema() 
            AND table_name IN ('users', 'guest_sessions', 'carts')
        `;
        const existingNames = tables.map((t) => t.table_name);
        data.database.tablesExist = {
          users: existingNames.includes('users'),
          guest_sessions: existingNames.includes('guest_sessions'),
          carts: existingNames.includes('carts'),
        };
      } catch (error) {
        logSafeDatabaseError('demo/auth-readiness table-existence-check', error);
      }

      // 4. Prisma model checks
      // User model
      try {
        const adminUser = await prisma.user.findUnique({
          where: { email: DEMO_ADMIN_EMAIL },
          select: {
            id: true,
            password: true,
          },
        });

        data.database.userTableReachable = true;
        if (data.database.prismaModelChecks) {
          data.database.prismaModelChecks.userModelOk = true;
        }
        data.auth.adminUserExists = Boolean(adminUser);
        data.auth.adminHasPasswordHash = Boolean(adminUser?.password);
      } catch (error) {
        logSafeDatabaseError('demo/auth-readiness user-model-check', error);
        if (data.database.prismaModelChecks) {
          data.database.prismaModelChecks.userModelOk = false;
        }
      }

      // GuestSession model
      try {
        await prisma.guestSession.findFirst({
          select: { id: true },
        });

        data.database.guestSessionTableReachable = true;
        data.guest.guestSessionModelReachable = true;
        if (data.database.prismaModelChecks) {
          data.database.prismaModelChecks.guestSessionModelOk = true;
        }
      } catch (error) {
        const safeError = getSafeDatabaseErrorDetails(error);

        if (data.database.prismaModelChecks) {
          data.database.prismaModelChecks.guestSessionModelOk = false;
        }

        if (safeError.connectivityCode === 'DATABASE_SCHEMA_NOT_READY') {
          data.database.prismaErrorCode = safeError.code;
          data.database.prismaErrorName = safeError.name;
          data.database.prismaErrorMessageSafe = safeError.messageSafe;
          data.warnings.push('GUEST_SESSION_TABLE_MISSING');
        } else {
          logSafeDatabaseError('demo/auth-readiness guest-session-model-check', error);
          applyDatabaseError(data, error, data.warnings);
        }
      }

      // Cart model
      try {
        await prisma.cart.findFirst({
          select: { id: true },
        });
        if (data.database.prismaModelChecks) {
          data.database.prismaModelChecks.cartModelOk = true;
        }
      } catch (error) {
        logSafeDatabaseError('demo/auth-readiness cart-model-check', error);
        if (data.database.prismaModelChecks) {
          data.database.prismaModelChecks.cartModelOk = false;
        }
      }
    }
  }

  if (data.database.connection === 'ok') {
    data.auth.providers.credentials = data.database.userTableReachable && data.auth.hasNextAuthUrl && data.auth.nextAuthUrlMatchesDeployment && data.auth.hasAnyAuthSecret;
    data.auth.providers.guest = data.database.guestSessionTableReachable;
    data.auth.providers.google = data.auth.providers.credentials && googleConfigured;
    data.auth.providers.phone = data.auth.providers.credentials && firebaseClientConfigured && firebaseAdminConfigured;
  }

  data.warnings = [...new Set([...data.warnings, ...buildWarnings(data)])];

  return setNoStoreHeaders(successResponse(data));
}
