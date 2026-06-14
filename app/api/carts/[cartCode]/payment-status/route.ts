import { NextRequest } from 'next/server';
import { DeviceAuthService } from '@/lib/services/device-auth.service';
import { DevicePaymentService } from '@/lib/services/device-payment.service';
import { errorResponse, successResponse, ApiErrorResponse } from '@/lib/api-response';
import { devicePaymentStatusQuerySchema } from '@/lib/validations';
import { getPrismaConnectivityMessage, logSafeDatabaseError } from '@/lib/prisma-errors';
import { applyDeviceApiHeaders, handleDeviceOptions } from '@/lib/device-api-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function OPTIONS(request: NextRequest) {
  return handleDeviceOptions(request, ['GET']);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { cartCode: string } }
) {
  try {
    const cart = await DeviceAuthService.authenticateDevice(request, params.cartCode);
    const parsed = devicePaymentStatusQuerySchema.parse({
      receiptId: request.nextUrl.searchParams.get('receiptId')?.trim() || '',
    });
    const result = await DevicePaymentService.getPaymentStatus(cart, parsed.receiptId);

    return applyDeviceApiHeaders(
      request,
      successResponse(result),
      ['GET', 'OPTIONS']
    );
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return applyDeviceApiHeaders(
        request,
        errorResponse(error.errors[0]?.message || 'Receipt ID is required.', 400, 'VALIDATION_ERROR'),
        ['GET', 'OPTIONS']
      );
    }

    if (error instanceof ApiErrorResponse) {
      return applyDeviceApiHeaders(
        request,
        errorResponse(error.message, error.statusCode, error.code),
        ['GET', 'OPTIONS']
      );
    }

    const databaseMessage = getPrismaConnectivityMessage(error);
    if (databaseMessage) {
      logSafeDatabaseError('carts/[cartCode]/payment-status GET', error);
      return applyDeviceApiHeaders(
        request,
        errorResponse(databaseMessage, 503, 'DATABASE_UNAVAILABLE'),
        ['GET', 'OPTIONS']
      );
    }

    console.error('Error fetching device payment status:', { message: 'Unexpected device payment-status failure.' });
    return applyDeviceApiHeaders(
      request,
      errorResponse('Failed to fetch payment status.', 500, 'INTERNAL_SERVER_ERROR'),
      ['GET', 'OPTIONS']
    );
  }
}
