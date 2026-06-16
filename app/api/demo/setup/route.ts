import { errorResponse, successResponse } from '@/lib/api-response';
import { getAdminEmails, isAdminEmail } from '@/lib/admin-emails';
import { requireDemoSetupToken } from '@/lib/demo-setup-auth';
import { DEMO_ADMIN_EMAIL, provisionDemoState } from '@/lib/demo-setup';
import { DEFAULT_SIMULATOR_CART_CODE, DEMO_CART_PRESETS } from '@/lib/cart-code';
import { prisma } from '@/lib/prisma';
import { getPrismaConnectivityCode, getPrismaConnectivityMessage, logSafeDatabaseError } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

export async function POST(request: Request) {
  const authResult = requireDemoSetupToken(request);
  if (!authResult.ok) {
    return authResult.response;
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
        cartCode: DEFAULT_SIMULATOR_CART_CODE,
        supportedCartCodes: DEMO_CART_PRESETS.map((preset) => preset.cartCode),
        exists: result.cartExists,
        hasDeviceSecret: result.hasDeviceSecret,
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
