import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ownerWhere, requireUserOrGuest } from '@/lib/guest-session';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const owner = await requireUserOrGuest();

    if (!owner) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const receipt = await prisma.receipt.findFirst({
      where: {
        id: params.id,
        ...ownerWhere(owner),
      },
      include: {
        items: {
          orderBy: { scannedAt: 'desc' },
        },
      },
    });

    if (!receipt) {
      return errorResponse('Receipt not found', 404, 'NOT_FOUND');
    }

    const response = successResponse(receipt);
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return response;
  } catch (error) {
    console.error('Error fetching receipt:', error);
    return errorResponse('Failed to fetch receipt', 500, 'INTERNAL_SERVER_ERROR');
  }
}

