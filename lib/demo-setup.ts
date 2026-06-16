import { type CartStatus, type PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  DEFAULT_SIMULATOR_CART_CODE,
  DEMO_CART_CODE,
  DEMO_CART_PRESETS,
  DEMO_DEVICE_SECRET,
  getDemoCartBluetoothName,
} from '@/lib/cart-code';

export { DEMO_CART_CODE } from '@/lib/cart-code';

export const DEMO_ADMIN_EMAIL = 'admin@gmail.com';
export const DEMO_ADMIN_NAME = 'Admin';
export const DEMO_ADMIN_PASSWORD = 'Admin_1';
export const DEMO_STORE_ID = 'dev-carto-store';

type DemoProvisionOptions = {
  deviceSecret?: string;
};

export type DemoProvisionResult = {
  adminUserExists: boolean;
  adminHasPasswordHash: boolean;
  cartExists: boolean;
  hasDeviceSecret: boolean;
  cartStatus: 'AVAILABLE' | 'IN_USE';
  guestSessionTableReachable: boolean;
};

type DemoCartProvisionResult = {
  cartCode: string;
  cartExists: boolean;
  hasDeviceSecret: boolean;
  status: 'AVAILABLE' | 'IN_USE';
};

async function ensureDemoStore(prisma: PrismaClient) {
  return prisma.store.upsert({
    where: { id: DEMO_STORE_ID },
    update: {
      name: 'Carto Demo Store',
      location: 'Demo seed',
    },
    create: {
      id: DEMO_STORE_ID,
      name: 'Carto Demo Store',
      location: 'Demo seed',
    },
  });
}

function resolveDemoDeviceSecret(cartCode: string, options: DemoProvisionOptions) {
  if (cartCode === DEMO_CART_CODE) {
    return options.deviceSecret || process.env.DEMO_DEVICE_SECRET?.trim() || DEMO_DEVICE_SECRET;
  }

  const preset = DEMO_CART_PRESETS.find((entry) => entry.cartCode === cartCode);
  const envName = `DEMO_DEVICE_SECRET_${cartCode.toUpperCase().replace(/-/g, '_')}`;
  return process.env[envName]?.trim() || preset?.deviceSecret || '';
}

export async function provisionDemoCart(
  prisma: PrismaClient,
  options: DemoProvisionOptions = {}
): Promise<DemoCartProvisionResult> {
  const now = new Date();
  const store = await ensureDemoStore(prisma);

  await prisma.$transaction(async (tx) => {
    for (const preset of DEMO_CART_PRESETS) {
      const existingCart = await tx.cart.findFirst({
        where: {
          OR: [
            { cartCode: preset.cartCode },
            ...((preset.legacyCartCodes ?? []).map((legacyCode) => ({ cartCode: legacyCode }))),
          ],
        },
        select: {
          id: true,
        },
      });

      const hasActiveSession = existingCart
        ? Boolean(await tx.cartSession.findFirst({
            where: {
              cartId: existingCart.id,
              status: { in: ['ACTIVE', 'DISCONNECTED'] },
              endedAt: null,
            },
            select: { id: true },
          }))
        : false;
      const targetStatus: CartStatus = hasActiveSession ? 'IN_USE' : 'AVAILABLE';
      const deviceSecret = resolveDemoDeviceSecret(preset.cartCode, options);

      if (existingCart) {
        await tx.cart.update({
          where: { id: existingCart.id },
          data: {
            cartCode: preset.cartCode,
            bluetoothName: getDemoCartBluetoothName(preset.cartCode),
            pairingCode: null,
            pairingExpiresAt: null,
            qrSessionId: null,
            deviceSecret,
            status: targetStatus,
            storeId: store.id,
            lastSeen: now,
          },
        });
      } else {
        await tx.cart.create({
          data: {
            cartCode: preset.cartCode,
            bluetoothName: getDemoCartBluetoothName(preset.cartCode),
            pairingCode: null,
            pairingExpiresAt: null,
            qrSessionId: null,
            deviceSecret,
            status: targetStatus,
            storeId: store.id,
            lastSeen: now,
          },
        });
      }
    }
  });

  const defaultSimulatorCart = await prisma.cart.findFirst({
    where: {
      cartCode: DEFAULT_SIMULATOR_CART_CODE,
    },
    select: {
      status: true,
      deviceSecret: true,
    },
  });

  return {
    cartCode: DEFAULT_SIMULATOR_CART_CODE,
    cartExists: true,
    hasDeviceSecret: Boolean(defaultSimulatorCart?.deviceSecret),
    status: defaultSimulatorCart?.status === 'IN_USE' ? 'IN_USE' : 'AVAILABLE',
  };
}

export async function provisionDemoState(prisma: PrismaClient, options: DemoProvisionOptions = {}): Promise<DemoProvisionResult> {
  const adminPasswordHash = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 12);

  await prisma.user.upsert({
    where: { email: DEMO_ADMIN_EMAIL },
    update: {
      email: DEMO_ADMIN_EMAIL,
      password: adminPasswordHash,
      name: DEMO_ADMIN_NAME,
    },
    create: {
      email: DEMO_ADMIN_EMAIL,
      password: adminPasswordHash,
      name: DEMO_ADMIN_NAME,
    },
  });

  const cart = await provisionDemoCart(prisma, options);

  await prisma.guestSession.findFirst({
    select: { id: true },
  });

  return {
    adminUserExists: true,
    adminHasPasswordHash: true,
    cartExists: cart.cartExists,
    hasDeviceSecret: cart.hasDeviceSecret,
    cartStatus: cart.status,
    guestSessionTableReachable: true,
  };
}
