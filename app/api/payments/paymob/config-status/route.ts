import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api-response';
import { guardAdminApi } from '@/lib/admin-auth';
import { getHostedPaymobEnvDebugInfo, isPaymobPreviewModeEnabled } from '@/lib/paymob/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const adminError = await guardAdminApi(request);

  if (adminError) {
    return adminError;
  }

  try {
    const response = successResponse({
      checkedAt: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV || 'development',
      vercelEnv: process.env.VERCEL_ENV || null,
      previewModeEnabled: isPaymobPreviewModeEnabled(),
      ...getHostedPaymobEnvDebugInfo(),
    });

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error) {
    console.error('Error reading Paymob config status.', error);
    return errorResponse('Failed to read Paymob config status.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
