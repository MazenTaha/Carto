import { successResponse } from '@/lib/api-response';
import { getAppRuntimeEnvironment, getSafeDatabaseUrlInfo } from '@/lib/database-url-info';
import { prisma } from '@/lib/prisma';
import { ACTIVE_CART_SESSION_STATUSES } from '@/lib/cart-session-status';
import { CartConnectionService } from '@/lib/services/cart-connection.service';
import { getSafeDatabaseErrorDetails, logSafeDatabaseError } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const DEMO_ADMIN_EMAIL = 'admin@gmail.com';

function setNoStoreHeaders(response: Response) {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}

function hasConfiguredAllowedOrigins() {
  const raw = process.env.CART_DEVICE_ALLOWED_ORIGINS?.trim();
  return Boolean(raw && raw !== '[]');
}

function isAdminAccessConfigured(email: string) {
  const raw = process.env.ADMIN_EMAILS ?? '';
  const configuredEmails = raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return configuredEmails.includes(email.toLowerCase());
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cartCode = searchParams.get('cartCode')?.trim().toUpperCase() || 'CART-001';
  const warnings: string[] = [];
  const runtimeEnvironment = getAppRuntimeEnvironment();
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());

  const data = {
    backend: 'ok' as const,
    runtime: runtimeEnvironment,
    database: {
      hasDatabaseUrl,
      connection: (hasDatabaseUrl ? 'ok' : 'missing') as 'ok' | 'error' | 'missing',
      prismaErrorCode: null as string | null,
      prismaErrorName: null as string | null,
      prismaErrorMessageSafe: null as string | null,
      runtime: runtimeEnvironment,
      nodeEnv: process.env.NODE_ENV || 'development',
      dbUrlInfo: getSafeDatabaseUrlInfo(),
    },
    cart: {
      exists: false,
      cartCode,
      status: null as string | null,
      hasDeviceSecret: false,
    },
    adminUser: {
      exists: false,
      email: DEMO_ADMIN_EMAIL,
      hasPasswordHash: false,
      adminAccessConfigured: isAdminAccessConfigured(DEMO_ADMIN_EMAIL),
    },
    endpoints: {
      qrcode: `/api/carts/${encodeURIComponent(cartCode)}/qrcode`,
      activeSession: `/api/carts/${encodeURIComponent(cartCode)}/active-session`,
      link: '/api/cart/link',
    },
    activeSessionExists: false,
    warnings,
  };

  if (!hasDatabaseUrl) {
    warnings.push('DATABASE_URL is not configured on the server.');
    warnings.push('Until DATABASE_URL is set and redeployed, the Vercel demo backend cannot serve cart/device state.');

    if (!data.adminUser.adminAccessConfigured) {
      warnings.push(`ADMIN_EMAILS does not currently include ${DEMO_ADMIN_EMAIL}. Production admin pages will stay blocked even if the user exists in the database.`);
    }

    if (!hasConfiguredAllowedOrigins()) {
      warnings.push('CART_DEVICE_ALLOWED_ORIGINS is not configured. Expo Web or browser-based device clients may need it.');
    }

    return setNoStoreHeaders(successResponse(data));
  }

  try {
    await CartConnectionService.reconcileCartByCode(cartCode);

    const cart = await prisma.cart.findUnique({
      where: { cartCode },
      select: {
        id: true,
        cartCode: true,
        status: true,
        deviceSecret: true,
      },
    });

    const adminUser = await prisma.user.findUnique({
      where: { email: DEMO_ADMIN_EMAIL },
      select: {
        email: true,
        password: true,
      },
    });

    if (!cart) {
      warnings.push(`Cart ${cartCode} does not exist in the database. Seed or create it before the demo.`);
    } else {
      const activeSession = await prisma.cartSession.findFirst({
        where: {
          cartId: cart.id,
          status: { in: [...ACTIVE_CART_SESSION_STATUSES] },
          endedAt: null,
        },
        select: { id: true },
        orderBy: { startedAt: 'desc' },
      });

      data.cart.exists = true;
      data.cart.status = activeSession ? 'IN_USE' : cart.status;
      data.cart.hasDeviceSecret = Boolean(cart.deviceSecret);
      data.activeSessionExists = Boolean(activeSession);

      if (!cart.deviceSecret) {
        warnings.push(`Cart ${cartCode} is missing a device secret.`);
      }

      if (!activeSession && cart.status !== 'AVAILABLE') {
        warnings.push(`Cart ${cartCode} is ${cart.status}. Reset or free it before the demo.`);
      }

      if (activeSession) {
        warnings.push(`Cart ${cartCode} already has an active session. Close or reset it before starting the demo.`);
      }
    }

    data.adminUser.exists = Boolean(adminUser);
    data.adminUser.hasPasswordHash = Boolean(adminUser?.password);

    if (!adminUser) {
      warnings.push(`Admin user ${DEMO_ADMIN_EMAIL} does not exist in the database.`);
    } else if (!adminUser.password) {
      warnings.push(`Admin user ${DEMO_ADMIN_EMAIL} exists but is missing a password hash, so credentials login will fail.`);
    }

    if (!data.adminUser.adminAccessConfigured) {
      warnings.push(`ADMIN_EMAILS does not include ${DEMO_ADMIN_EMAIL}. The user can sign in, but production admin routes will still deny access.`);
    }

    if (!hasConfiguredAllowedOrigins()) {
      warnings.push('CART_DEVICE_ALLOWED_ORIGINS is not configured. This is fine for native/server device clients, but Expo Web or browser-based device clients may need it.');
    }
  } catch (error) {
    const safeError = getSafeDatabaseErrorDetails(error);
    logSafeDatabaseError('demo/device-readiness GET', error);
    data.database.connection = 'error';
    data.database.prismaErrorCode = safeError.code;
    data.database.prismaErrorName = safeError.name;
    data.database.prismaErrorMessageSafe = safeError.messageSafe;
    warnings.push(safeError.messageSafe || 'Database query failed while checking demo readiness.');
  }

  return setNoStoreHeaders(successResponse(data));
}
