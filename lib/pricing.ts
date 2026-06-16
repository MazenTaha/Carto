export const DEFAULT_BASE_PRICE_EGP = 1;

export function normalizeBasePriceEGP(price: number | null | undefined) {
  return Number.isFinite(price) && Number(price) > 0
    ? Number(price)
    : DEFAULT_BASE_PRICE_EGP;
}
