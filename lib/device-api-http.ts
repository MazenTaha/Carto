import { NextRequest } from 'next/server';
import { DEVICE_CORS_HEADERS, applyCorsHeaders, corsPreflightResponse } from '@/lib/cors';

type DeviceApiMethod = 'GET' | 'POST' | 'OPTIONS';

export function applyDeviceApiHeaders(
  request: NextRequest,
  response: Response,
  methods: DeviceApiMethod[],
  options?: { noStore?: boolean }
) {
  if (options?.noStore !== false) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  response.headers.set('Allow', methods.join(', '));
  applyCorsHeaders(response, DEVICE_CORS_HEADERS);

  return response;
}

export function handleDeviceOptions(request: NextRequest, methods: Array<'GET' | 'POST'>) {
  const response = corsPreflightResponse();
  response.headers.set('Allow', [...methods, 'OPTIONS'].join(', '));
  return response;
}
