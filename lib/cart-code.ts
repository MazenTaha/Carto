import type { Prisma } from '@prisma/client';

export const DEMO_CART_CODE = 'cart-01';
export const DEFAULT_SIMULATOR_CART_CODE = 'cart-02';
export const LEGACY_DEMO_CART_CODE = 'CART-001';
export const DEMO_DEVICE_SECRET = 'dev-device-secret';
export const DEFAULT_SIMULATOR_DEVICE_SECRET = 'dev-device-secret-2';

export type DemoCartPreset = {
  cartCode: string;
  deviceSecret: string;
  label: string;
  legacyCartCodes?: string[];
};

export const DEMO_CART_PRESETS: DemoCartPreset[] = [
  {
    cartCode: DEMO_CART_CODE,
    deviceSecret: DEMO_DEVICE_SECRET,
    label: 'Cart 01',
    legacyCartCodes: [LEGACY_DEMO_CART_CODE],
  },
  {
    cartCode: DEFAULT_SIMULATOR_CART_CODE,
    deviceSecret: DEFAULT_SIMULATOR_DEVICE_SECRET,
    label: 'Cart 02',
  },
];

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

export function getDemoCartPreset(cartCode: string) {
  const normalized = cartCode.trim().toLowerCase();

  return (
    DEMO_CART_PRESETS.find((preset) => {
      if (preset.cartCode.toLowerCase() === normalized) {
        return true;
      }

      return preset.legacyCartCodes?.some((legacyCode) => legacyCode.toLowerCase() === normalized);
    }) ?? null
  );
}

export function getDefaultSimulatorCartPreset() {
  return DEMO_CART_PRESETS.find((preset) => preset.cartCode === DEFAULT_SIMULATOR_CART_CODE) ?? DEMO_CART_PRESETS[0];
}

export function isDemoCartCode(cartCode: string) {
  return Boolean(getDemoCartPreset(cartCode));
}

export function normalizeCartCode(cartCode: string) {
  const trimmed = cartCode.trim();
  if (!trimmed) return '';

  const preset = getDemoCartPreset(trimmed);
  if (preset) {
    return preset.cartCode;
  }

  return trimmed.toLowerCase();
}

export function getCartCodeLookupCandidates(cartCode: string) {
  const trimmed = cartCode.trim();
  if (!trimmed) return [];

  const preset = getDemoCartPreset(trimmed);
  if (preset) {
    return [preset.cartCode];
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
