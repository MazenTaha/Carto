import { Prisma } from '@prisma/client';
import { ACTIVE_CART_SESSION_STATUSES } from '@/lib/cart-session-status';

export const CUSTOMER_CURRENT_CART_SESSION_STATUSES = [...ACTIVE_CART_SESSION_STATUSES, 'COMPLETED'] as const;

export function isCurrentCustomerCartSessionStatus(status: string) {
  return CUSTOMER_CURRENT_CART_SESSION_STATUSES.includes(
    status as (typeof CUSTOMER_CURRENT_CART_SESSION_STATUSES)[number]
  );
}

export function buildCurrentCustomerCartSessionWhere(
  baseWhere: Prisma.CartSessionWhereInput = {}
): Prisma.CartSessionWhereInput {
  return {
    ...baseWhere,
    OR: [
      {
        status: { in: [...ACTIVE_CART_SESSION_STATUSES] },
        endedAt: null,
      },
      {
        status: 'COMPLETED',
        receipt: {
          is: {
            status: { not: 'PAID' },
          },
        },
      },
    ],
  };
}
