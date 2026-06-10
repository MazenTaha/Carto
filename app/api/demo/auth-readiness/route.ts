import { successResponse } from '@/lib/api-response';
import { isAdminEmail } from '@/lib/admin-emails';
import { GUEST_SESSION_COOKIE } from '@/lib/guest-session.constants';
import { prisma } from '@/lib/prisma';
import { getPrismaConnectivityMessage } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';

const DEMO_ADMIN_EMAIL = 'admin@gmail.com';

function setNoStoreHeaders(response: Response) {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}

function hasConfiguredAuthSecret() {
  return Boolean(process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim());
}

export async function GET() {
  const warnings: string[] = [];

  const data = {
    database: process.env.DATABASE_URL ? ('ok' as 'ok' | 'error' | 'missing') : ('missing' as 'ok' | 'error' | 'missing'),
    auth: {
      hasNextAuthUrl: Boolean(process.env.NEXTAUTH_URL?.trim()),
      hasAuthSecret: hasConfiguredAuthSecret(),
      userTableReachable: false,
      adminUserExists: false,
      adminUserEmail: DEMO_ADMIN_EMAIL,
      adminHasPasswordHash: false,
      adminAccessConfigured: isAdminEmail(DEMO_ADMIN_EMAIL),
    },
    guest: {
      guestSessionTableReachable: false,
      guestModeApi: '/api/auth/guest',
      cookieName: GUEST_SESSION_COOKIE,
    },
    warnings,
  };

  if (!data.auth.hasNextAuthUrl) {
    warnings.push('NEXTAUTH_URL is not configured.');
  }

  if (!data.auth.hasAuthSecret) {
    warnings.push('AUTH_SECRET or NEXTAUTH_SECRET is not configured.');
  }

  if (!data.auth.adminAccessConfigured) {
    warnings.push(`ADMIN_EMAILS does not include ${DEMO_ADMIN_EMAIL}. Production admin routes will stay blocked.`);
  }

  if (!process.env.DATABASE_URL) {
    warnings.push('DATABASE_URL is not configured on the server.');
    return setNoStoreHeaders(successResponse(data));
  }

  try {
    const [adminUser] = await Promise.all([
      prisma.user.findUnique({
        where: { email: DEMO_ADMIN_EMAIL },
        select: {
          id: true,
          password: true,
        },
      }),
      prisma.guestSession.findFirst({
        select: { id: true },
      }),
    ]);

    data.auth.userTableReachable = true;
    data.guest.guestSessionTableReachable = true;
    data.auth.adminUserExists = Boolean(adminUser);
    data.auth.adminHasPasswordHash = Boolean(adminUser?.password);

    if (!adminUser) {
      warnings.push(`Admin user ${DEMO_ADMIN_EMAIL} does not exist in the database.`);
    } else if (!adminUser.password) {
      warnings.push(`Admin user ${DEMO_ADMIN_EMAIL} exists but is missing a password hash.`);
    }
  } catch (error) {
    data.database = 'error';
    const databaseMessage = getPrismaConnectivityMessage(error);
    warnings.push(databaseMessage || 'Database query failed while checking auth readiness.');
  }

  return setNoStoreHeaders(successResponse(data));
}
