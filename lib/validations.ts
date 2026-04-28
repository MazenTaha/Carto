// Zod validation schemas

import { z } from 'zod';

// ─── Authentication ────────────────────────────────────────────────────────────

export const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
});

export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ─── Shopping Lists ────────────────────────────────────────────────────────────

export const createListSchema = z.object({
  name: z.string().min(1, 'List name is required').max(100, 'List name is too long'),
});

export const updateListSchema = z.object({
  name: z.string().min(1, 'List name is required').max(100, 'List name is too long').optional(),
});

export const createListItemSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(200, 'Item name is too long'),
  quantity: z.number().int().positive().default(1),
  price: z.number().min(0).optional(),
  category: z.string().max(50).optional(),
});

export const updateListItemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  quantity: z.number().int().positive().optional(),
  price: z.number().min(0).optional(),
  category: z.string().max(50).optional(),
  isCollected: z.boolean().optional(),
});

// ─── Cart Linking ──────────────────────────────────────────────────────────────

export const linkCartSchema = z.object({
  cartId: z.string().trim().min(1, 'Cart ID is required').max(80, 'Cart ID is too long').optional(),
  cartCode: z.string().trim().min(1, 'Cart code is required').max(80, 'Cart code is too long').optional(),
  bluetoothName: z.string().trim().min(1, 'Bluetooth name is required').max(120, 'Bluetooth name is too long').optional(),
  pairingCode: z.string().trim().min(1, 'Pairing code is required').max(64, 'Pairing code is too long').optional(),
  sessionId: z.string().trim().min(1, 'QR session ID is required').max(128, 'QR session ID is too long').optional(),
  listId: z.string().min(1, 'List ID is required'),
}).superRefine((data, ctx) => {
  const cartIdentifier = data.cartId || data.cartCode;

  if (!cartIdentifier) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Cart ID is required',
      path: ['cartId'],
    });
  }

  if ((data.bluetoothName || data.sessionId) && !data.pairingCode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Pairing code is required',
      path: ['pairingCode'],
    });
  }
});

export const cartQrPayloadSchema = z.object({
  cartId: z.string().trim().min(1, 'QR code is missing cartId').max(80, 'Cart ID is too long'),
  bluetoothName: z.string().trim().min(1, 'QR code is missing bluetoothName').max(120, 'Bluetooth name is too long'),
  pairingCode: z.string().trim().min(1, 'QR code is missing pairingCode').max(64, 'Pairing code is too long'),
  sessionId: z.string().trim().min(1, 'QR code is missing sessionId').max(128, 'QR session ID is too long'),
});

// ─── Stores ────────────────────────────────────────────────────────────────────

export const createStoreSchema = z.object({
  name: z.string().min(1, 'Store name is required').max(100),
  location: z.string().max(200).optional(),
  currency: z.string().length(3, 'Currency must be a 3-letter code').default('USD'),
  taxRate: z.number().min(0).max(1).default(0.085),
  logo: z.string().url().optional(),
});

// ─── Product Search ────────────────────────────────────────────────────────────

export const searchProductSchema = z.object({
  q: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  category: z.string().max(50).optional(),
});

// ─── Wishlist ──────────────────────────────────────────────────────────────────

export const createWishlistItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  note: z.string().max(500).optional(),
});

// ─── Favorites ─────────────────────────────────────────────────────────────────

export const addFavoriteSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
});

// ─── Notifications ─────────────────────────────────────────────────────────────

export const markNotificationsReadSchema = z.object({
  notificationIds: z.array(z.string()).min(1, 'At least one notification ID is required'),
});

// ─── Payment ───────────────────────────────────────────────────────────────────

export const createPaymentSchema = z.object({
  receiptId: z.string().min(1, 'Receipt ID is required'),
  sessionId: z.string().min(1, 'Session ID is required'),
  amount: z.number().positive('Amount must be positive'),
  paymentMethod: z.enum(['CARD', 'CASH', 'MOBILE', 'WALLET']).default('CARD'),
});
