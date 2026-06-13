import { Prisma } from '@prisma/client';
import { ACTIVE_CART_SESSION_STATUSES } from '@/lib/cart-session-status';

export const CUSTOMER_CURRENT_CART_SESSION_STATUSES = [...ACTIVE_CART_SESSION_STATUSES] as const;

type CurrentCustomerSessionState = {
  status: string;
  endedAt: Date | null;
  cartStatus: string | null | undefined;
  receiptStatus?: string | null;
  paymentStatus?: string | null;
};

export function isCurrentCustomerCartSessionStatus(status: string) {
  return CUSTOMER_CURRENT_CART_SESSION_STATUSES.includes(
    status as (typeof CUSTOMER_CURRENT_CART_SESSION_STATUSES)[number]
  );
}

export function isCurrentCustomerSessionLive({
  status,
  endedAt,
  cartStatus,
  receiptStatus,
  paymentStatus,
}: CurrentCustomerSessionState) {
  if (!isCurrentCustomerCartSessionStatus(status)) {
    return false;
  }

  if (endedAt) {
    return false;
  }

  if (cartStatus !== 'IN_USE') {
    return false;
  }

  if (receiptStatus === 'PAID' || receiptStatus === 'CANCELLED') {
    return false;
  }

  if (paymentStatus === 'COMPLETED' || paymentStatus === 'REFUNDED') {
    return false;
  }

  return true;
}

export function buildCurrentCustomerCartSessionWhere(
  baseWhere: Prisma.CartSessionWhereInput = {}
): Prisma.CartSessionWhereInput {
  return {
    ...baseWhere,
    status: { in: [...ACTIVE_CART_SESSION_STATUSES] },
    endedAt: null,
    OR: [
      {
        receipt: {
          is: null,
        },
      },
      {
        receipt: {
          is: {
            status: { in: ['DRAFT', 'LOCKED'] },
            paymentStatus: { in: ['PENDING', 'PROCESSING', 'FAILED'] },
          },
        },
      },
    ],
  };
}
