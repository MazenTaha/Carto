import { errorResponse, successResponse } from '@/lib/api-response';
import { provisionDemoCart } from '@/lib/demo-setup';
import { prisma } from '@/lib/prisma';
import { getPrismaConnectivityCode, getPrismaConnectivityMessage, logSafeDatabaseError } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

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
