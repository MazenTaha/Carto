import { SessionStatus, type PrismaClient } from '@prisma/client';
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

const ACTIVE_SESSION_STATUSES: SessionStatus[] = [SessionStatus.ACTIVE, SessionStatus.DISCONNECTED];

type DemoProvisionOptions = {
  deviceSecret?: string;
};

export type DemoProvisionResult = {
  adminUserExists: boolean;
  adminHasPasswordHash: boolean;
  cartExists: boolean;
  cartStatus: 'AVAILABLE';
  guestSessionTableReachable: boolean;
};

export async function provisionDemoState(prisma: PrismaClient, options: DemoProvisionOptions = {}): Promise<DemoProvisionResult> {
  const now = new Date();
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

  const store = await prisma.store.upsert({
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

  const activeSessionIds = existingCart
    ? (await prisma.cartSession.findMany({
        where: {
          cartId: existingCart.id,
          status: { in: ACTIVE_SESSION_STATUSES },
          endedAt: null,
        },
        select: { id: true },
      })).map((session) => session.id)
    : [];

  await prisma.$transaction(async (tx) => {
    if (activeSessionIds.length > 0) {
      await tx.cartSession.updateMany({
        where: { id: { in: activeSessionIds } },
        data: {
          status: SessionStatus.COMPLETED,
          endedAt: now,
        },
      });

      await tx.receipt.updateMany({
        where: {
          sessionId: { in: activeSessionIds },
          status: 'DRAFT',
        },
        data: {
          status: 'LOCKED',
        },
      });
    }

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
          status: 'AVAILABLE',
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
          status: 'AVAILABLE',
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
          status: 'AVAILABLE',
          storeId: store.id,
          lastSeen: now,
        },
      });
    }
  });

  await prisma.guestSession.findFirst({
    select: { id: true },
  });

  return {
    adminUserExists: true,
    adminHasPasswordHash: true,
    cartExists: true,
    cartStatus: 'AVAILABLE',
    guestSessionTableReachable: true,
  };
}
