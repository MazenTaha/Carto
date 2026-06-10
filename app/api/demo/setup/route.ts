import { errorResponse, successResponse } from '@/lib/api-response';
import { getAdminEmails, isAdminEmail } from '@/lib/admin-emails';
import { DEMO_ADMIN_EMAIL, DEMO_CART_CODE, provisionDemoState } from '@/lib/demo-setup';
import { prisma } from '@/lib/prisma';
import { getPrismaConnectivityCode, getPrismaConnectivityMessage, logSafeDatabaseError } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function readBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token?.trim()) {
    return null;
  }

  return token.trim();
}

export async function POST(request: Request) {
  const configuredToken = process.env.DEMO_SETUP_TOKEN?.trim();

  if (!configuredToken) {
    return errorResponse('DEMO_SETUP_TOKEN is not configured on the server.', 503, 'DEMO_SETUP_TOKEN_MISSING');
  }

  const providedToken = readBearerToken(request);
  if (!providedToken || providedToken !== configuredToken) {
    return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
  }

  if (!process.env.DATABASE_URL?.trim()) {
    return errorResponse('Database unavailable. DATABASE_URL is not configured on the server.', 503, 'DATABASE_URL_MISSING');
  }

  try {
    const result = await provisionDemoState(prisma);

    return successResponse({
      runtime: process.env.NODE_ENV || 'development',
      admin: {
        email: DEMO_ADMIN_EMAIL,
        exists: result.adminUserExists,
        hasPasswordHash: result.adminHasPasswordHash,
        adminEmailsConfigured: getAdminEmails().length > 0,
        adminAccessConfigured: isAdminEmail(DEMO_ADMIN_EMAIL),
      },
      cart: {
        cartCode: DEMO_CART_CODE,
        exists: result.cartExists,
        status: result.cartStatus,
      },
      guest: {
        guestSessionModelReachable: result.guestSessionTableReachable,
      },
      warnings: [
        ...(getAdminEmails().length > 0 ? [] : ['ADMIN_EMAILS_MISSING']),
        ...(isAdminEmail(DEMO_ADMIN_EMAIL) ? [] : ['ADMIN_EMAIL_NOT_ALLOWED']),
      ],
    });
  } catch (error) {
    const connectivityCode = getPrismaConnectivityCode(error);
    const databaseMessage = getPrismaConnectivityMessage(error);

    if (connectivityCode) {
      logSafeDatabaseError('demo/setup POST', error);
      return errorResponse(databaseMessage || 'Production database setup failed.', 503, connectivityCode);
    }

    console.error('[demo/setup POST]', { message: 'Unexpected setup failure.' });
    return errorResponse('Production demo setup failed.', 500, 'DEMO_SETUP_FAILED');
  }
}
