import { prisma } from '@/lib/prisma';
import type { RequestOwner } from '@/lib/guest-session';
import { ownerWhere } from '@/lib/guest-session';

export type ReceiptHistorySummary = {
  id: string;
  receiptNumber: string;
  createdAt: string;
  paidAt: string | null;
  total: number;
  status: string;
  paymentStatus: string;
  cartCode: string | null;
  listName: string | null;
  itemsCount: number;
};

export async function getCompletedReceiptHistory(owner: RequestOwner): Promise<ReceiptHistorySummary[]> {
  const receipts = await prisma.receipt.findMany({
    where: {
      ...ownerWhere(owner),
      status: 'PAID',
      paymentStatus: 'COMPLETED',
      cartSession: {
        is: {
          status: 'CHECKED_OUT',
          endedAt: {
            not: null,
          },
        },
      },
    },
    select: {
      id: true,
      total: true,
      status: true,
      paymentStatus: true,
      createdAt: true,
      paidAt: true,
      lockedAt: true,
      items: {
        select: {
          quantity: true,
        },
      },
      cartSession: {
        select: {
          endedAt: true,
          status: true,
          cart: {
            select: {
              cartCode: true,
            },
          },
          shoppingList: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return receipts
    .map((receipt) => ({
      id: receipt.id,
      receiptNumber: receipt.id.slice(-6).toUpperCase(),
      createdAt: receipt.createdAt.toISOString(),
      paidAt: receipt.paidAt?.toISOString() ?? receipt.lockedAt?.toISOString() ?? null,
      total: receipt.total,
      status: receipt.status,
      paymentStatus: receipt.paymentStatus,
      cartCode: receipt.cartSession?.cart?.cartCode ?? null,
      listName: receipt.cartSession?.shoppingList?.name ?? null,
      itemsCount: receipt.items.reduce((sum, item) => sum + item.quantity, 0),
    }));
}
