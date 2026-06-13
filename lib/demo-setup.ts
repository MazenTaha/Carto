import { type CartStatus, type PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  DEMO_CART_CODE,
  DEMO_DEVICE_SECRET,
  LEGACY_DEMO_CART_CODE,
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

export async function provisionDemoCart(prisma: PrismaClient, options: DemoProvisionOptions = {}) {
  const now = new Date();
  const deviceSecret = options.deviceSecret || process.env.DEMO_DEVICE_SECRET?.trim() || DEMO_DEVICE_SECRET;
  const store = await ensureDemoStore(prisma);

  const existingCart = await prisma.cart.findFirst({
    where: {
      OR: [
        { cartCode: DEMO_CART_CODE },
        { cartCode: LEGACY_DEMO_CART_CODE },
      ],
    },
    select: {
      id: true,
      cartCode: true,
    },
  });

  const hasActiveSession = existingCart
    ? Boolean(await prisma.cartSession.findFirst({
        where: {
          cartId: existingCart.id,
          status: { in: ['ACTIVE', 'DISCONNECTED'] },
          endedAt: null,
        },
        select: { id: true },
      }))
    : false;
  const targetStatus: CartStatus = hasActiveSession ? 'IN_USE' : 'AVAILABLE';

  await prisma.$transaction(async (tx) => {
    const canonicalCart = await tx.cart.findUnique({
      where: { cartCode: DEMO_CART_CODE },
      select: { id: true },
    });
    const legacyCart = canonicalCart
      ? null
      : await tx.cart.findUnique({
          where: { cartCode: LEGACY_DEMO_CART_CODE },
          select: { id: true },
        });

    if (canonicalCart) {
      await tx.cart.update({
        where: { id: canonicalCart.id },
        data: {
          cartCode: DEMO_CART_CODE,
          bluetoothName: getDemoCartBluetoothName(DEMO_CART_CODE),
          pairingCode: null,
          pairingExpiresAt: null,
          qrSessionId: null,
          deviceSecret,
          status: targetStatus,
          storeId: store.id,
          lastSeen: now,
        },
      });
    } else if (legacyCart) {
      await tx.cart.update({
        where: { id: legacyCart.id },
        data: {
          cartCode: DEMO_CART_CODE,
          bluetoothName: getDemoCartBluetoothName(DEMO_CART_CODE),
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
          cartCode: DEMO_CART_CODE,
          bluetoothName: getDemoCartBluetoothName(DEMO_CART_CODE),
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
  });

  return {
    cartCode: DEMO_CART_CODE,
    cartExists: true,
    hasDeviceSecret: Boolean(deviceSecret),
    status: targetStatus,
  };
}

export async function provisionDemoState(prisma: PrismaClient, options: DemoProvisionOptions = {}): Promise<DemoProvisionResult> {
  const deviceSecret = options.deviceSecret || process.env.DEMO_DEVICE_SECRET?.trim() || DEMO_DEVICE_SECRET;
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

  const cart = await provisionDemoCart(prisma, { deviceSecret });

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
