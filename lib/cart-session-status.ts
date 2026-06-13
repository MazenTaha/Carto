export const ACTIVE_CART_SESSION_STATUSES = ['ACTIVE'] as const;

export function isActiveCartSessionStatus(status: string) {
  return ACTIVE_CART_SESSION_STATUSES.includes(status as (typeof ACTIVE_CART_SESSION_STATUSES)[number]);
}
