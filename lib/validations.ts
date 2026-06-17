// Zod validation schemas

import { z } from 'zod';
import { normalizeEgyptianMobileNumber } from './phone';

// ─── Authentication ────────────────────────────────────────────────────────────

export const signUpSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Password must include a letter')
    .regex(/[0-9]/, 'Password must include a number'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').optional(),
});

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const phoneAuthVerifySchema = z.object({
  idToken: z.string().min(20, 'Firebase ID token is required'),
});

export const egyptianPhoneInputSchema = z.object({
  phoneNumber: z.string().transform((value, ctx) => {
    const normalized = normalizeEgyptianMobileNumber(value);

    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a valid Egyptian mobile number',
      });
      return z.NEVER;
    }

    return normalized;
  }),
});

// ─── Shopping Lists ────────────────────────────────────────────────────────────

export const createListSchema = z.object({
  name: z.string().min(1, 'List name is required').max(100, 'List name is too long'),
});

export const createListDraftRequestSchema = z.object({
  name: z.string().min(1, 'List name is required').max(100, 'List name is too long'),
});

export const createListRequestSchema = z.object({
  name: z.string().min(1, 'List name is required').max(100, 'List name is too long'),
  items: z.array(z.object({
    name: z.string().min(1, 'Item name is required').max(200, 'Item name is too long'),
    quantity: z.number().int().positive().default(1),
    price: z.number().min(0).optional(),
    category: z.string().max(50).optional(),
  })).min(1, 'Add at least one item before saving this list.'),
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
  cartCode: z.string().trim().min(1, 'Cart code is required').max(80, 'Cart code is too long'),
  pairingCode: z.string().trim().min(1, 'Pairing code is required').max(64, 'Pairing code is too long'),
  listId: z.string().min(1, 'List ID is required'),
});

export const cartQrPayloadSchema = z.object({
  type: z.literal('cart_pairing'),
  cartCode: z.string().trim().min(1, 'QR code is missing cartCode').max(80, 'Cart code is too long'),
  pairingCode: z.string().trim().min(1, 'QR code is missing pairingCode').max(64, 'Pairing code is too long'),
});

// ─── Stores ────────────────────────────────────────────────────────────────────

export const createStoreSchema = z.object({
  name: z.string().min(1, 'Store name is required').max(100),
  location: z.string().max(200).optional(),
  currency: z.string().length(3, 'Currency must be a 3-letter code').default('EGP'),
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
  receiptId: z.string().min(1, 'Receipt ID is required').optional(),
  sessionId: z.string().min(1, 'Session ID is required'),
  paymentMethod: z.enum(['CARD', 'CASH', 'MOBILE', 'WALLET']).default('CARD'),
});

export const createDevicePaymentQrSchema = z.object({
  amount: z.number().finite('Payment amount must be a valid number.').positive('Payment amount must be greater than 0.').optional(),
  currency: z.string().trim().min(1).default('EGP').optional(),
  items: z.array(
    z.object({
      name: z.string().trim().min(1, 'Item name is required'),
      quantity: z.number().int().positive('Item quantity must be greater than 0.'),
      unitPrice: z.number().finite('Item unit price must be a valid number.').nonnegative('Item unit price cannot be negative.'),
      total: z.number().finite('Item total must be a valid number.').nonnegative('Item total cannot be negative.'),
    })
  ).optional(),
});

export const devicePaymentStatusQuerySchema = z.object({
  receiptId: z.string().min(1, 'Receipt ID is required'),
});
