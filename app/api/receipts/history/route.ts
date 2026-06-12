import { requireUserOrGuest } from '@/lib/guest-session';
import { errorResponse, successResponse } from '@/lib/api-response';
import { getCompletedReceiptHistory } from '@/lib/receipt-history';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const owner = await requireUserOrGuest();

    if (!owner) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const receipts = await getCompletedReceiptHistory(owner);
    const response = successResponse({ receipts });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return response;
  } catch (error) {
    console.error('Error fetching receipt history:', error);
    return errorResponse('Failed to fetch receipt history', 500, 'INTERNAL_SERVER_ERROR');
  }
}
