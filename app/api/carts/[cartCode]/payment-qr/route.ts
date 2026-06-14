import { NextRequest } from 'next/server';
import { DeviceAuthService } from '@/lib/services/device-auth.service';
import { DevicePaymentService } from '@/lib/services/device-payment.service';
import { errorResponse, successResponse, ApiErrorResponse } from '@/lib/api-response';
import { createDevicePaymentQrSchema } from '@/lib/validations';
import { getPrismaConnectivityMessage, logSafeDatabaseError } from '@/lib/prisma-errors';
import { applyDeviceApiHeaders, handleDeviceOptions } from '@/lib/device-api-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function OPTIONS(request: NextRequest) {
  return handleDeviceOptions(request, ['POST']);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { cartCode: string } }
) {
  try {
    const cart = await DeviceAuthService.authenticateDevice(request, params.cartCode);

    const body = await request.json().catch(() => null);
    const parsed = createDevicePaymentQrSchema.parse(body);
    const result = await DevicePaymentService.createPaymentQr(cart, parsed, request.url);

    return applyDeviceApiHeaders(
      request,
      successResponse(result),
      ['POST', 'OPTIONS']
    );
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return applyDeviceApiHeaders(
        request,
        errorResponse(error.errors[0]?.message || 'Invalid payment QR payload.', 400, 'VALIDATION_ERROR'),
        ['POST', 'OPTIONS']
      );
    }

    if (error instanceof ApiErrorResponse) {
      return applyDeviceApiHeaders(
        request,
        errorResponse(error.message, error.statusCode, error.code),
        ['POST', 'OPTIONS']
      );
    }

    const databaseMessage = getPrismaConnectivityMessage(error);
    if (databaseMessage) {
      logSafeDatabaseError('carts/[cartCode]/payment-qr POST', error);
      return applyDeviceApiHeaders(
        request,
        errorResponse(databaseMessage, 503, 'DATABASE_UNAVAILABLE'),
        ['POST', 'OPTIONS']
      );
    }

    console.error('Error creating device payment QR:', { message: 'Unexpected device payment-qr failure.' });
    return applyDeviceApiHeaders(
      request,
      errorResponse('Failed to create payment QR.', 500, 'INTERNAL_SERVER_ERROR'),
      ['POST', 'OPTIONS']
    );
  }
}
