import type { Prisma } from '@prisma/client';

export const DEMO_CART_CODE = 'cart-01';
export const LEGACY_DEMO_CART_CODE = 'CART-001';
export const DEMO_DEVICE_SECRET = 'dev-device-secret';

function uniqueCaseInsensitive(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const key = value.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }

  return result;
}

export function isDemoCartCode(cartCode: string) {
  const normalized = cartCode.trim().toLowerCase();
  return normalized === DEMO_CART_CODE || normalized === LEGACY_DEMO_CART_CODE.toLowerCase();
}

export function normalizeCartCode(cartCode: string) {
  const trimmed = cartCode.trim();
  if (!trimmed) return '';

  if (isDemoCartCode(trimmed)) {
    return DEMO_CART_CODE;
  }

  return trimmed.toLowerCase();
}

export function getCartCodeLookupCandidates(cartCode: string) {
  const trimmed = cartCode.trim();
  if (!trimmed) return [];

  if (isDemoCartCode(trimmed)) {
    return [DEMO_CART_CODE];
  }

  return uniqueCaseInsensitive([trimmed, normalizeCartCode(trimmed)]);
}

export function buildCartCodeLookupWhere(cartCode: string): Prisma.CartWhereInput {
  const candidates = getCartCodeLookupCandidates(cartCode);

  return {
    OR: candidates.map((candidate) => ({
      cartCode: {
        equals: candidate,
        mode: 'insensitive',
      },
    })),
  };
}

export function getDemoCartBluetoothName(cartCode = DEMO_CART_CODE) {
  return `Carto-${normalizeCartCode(cartCode)}`;
}
