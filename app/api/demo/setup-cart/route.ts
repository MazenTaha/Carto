import { errorResponse, successResponse } from '@/lib/api-response';
import { requireDemoSetupToken } from '@/lib/demo-setup-auth';
import { provisionDemoCart } from '@/lib/demo-setup';
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
    const result = await provisionDemoCart(prisma);

    return successResponse({
      cartCode: result.cartCode,
      cartExists: result.cartExists,
      hasDeviceSecret: result.hasDeviceSecret,
      status: result.status,
    });
  } catch (error) {
    const connectivityCode = getPrismaConnectivityCode(error);
    const databaseMessage = getPrismaConnectivityMessage(error);

    if (connectivityCode) {
      logSafeDatabaseError('demo/setup-cart POST', error);
      return errorResponse(databaseMessage || 'Demo cart setup failed.', 503, connectivityCode);
    }

    console.error('[demo/setup-cart POST]', { message: 'Unexpected setup-cart failure.' });
    return errorResponse('Demo cart setup failed.', 500, 'DEMO_SETUP_CART_FAILED');
  }
}
