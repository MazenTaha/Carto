import { NextRequest, NextResponse } from 'next/server';

type DeviceApiMethod = 'GET' | 'POST' | 'OPTIONS';

function parseAllowedOrigins() {
  const raw = process.env.CART_DEVICE_ALLOWED_ORIGINS?.trim();

  if (!raw) {
    return [];
  }

  const normalized = raw.startsWith('[') && raw.endsWith(']')
    ? raw.slice(1, -1)
    : raw;

  return normalized
    .split(',')
    .map((origin) => origin.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

function getAllowedOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) {
    return null;
  }

  const allowedOrigins = parseAllowedOrigins();
  return allowedOrigins.includes(origin) ? origin : null;
}

export function applyDeviceApiHeaders(
  request: NextRequest,
  response: Response,
  methods: DeviceApiMethod[],
  options?: { noStore?: boolean }
) {
  const allowedOrigin = getAllowedOrigin(request);

  if (options?.noStore !== false) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  response.headers.set('Allow', methods.join(', '));
  response.headers.set('Vary', 'Origin');

  if (allowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    response.headers.set('Access-Control-Allow-Methods', methods.join(', '));
    response.headers.set('Access-Control-Max-Age', '600');
  }

  return response;
}

export function handleDeviceOptions(request: NextRequest, methods: Array<'GET' | 'POST'>) {
  return applyDeviceApiHeaders(
    request,
    new NextResponse(null, { status: 204 }),
    [...methods, 'OPTIONS'],
    { noStore: false }
  );
}
