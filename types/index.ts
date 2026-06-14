// Core TypeScript types for Carto application

// ─── User ──────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string | null;
  phoneNumber?: string | null;
  name: string | null;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export interface Store {
  id: string;
  name: string;
  location: string | null;
  currency: string;
  taxRate: number;
  logo: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Cart (Physical) ───────────────────────────────────────────────────────────

export type CartStatus = 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'OFFLINE';

export interface Cart {
  id: string;
  cartCode: string;
  bluetoothName: string | null;
  pairingCode?: string | null;
  deviceSecret?: string | null;
  pairingExpiresAt?: Date | null;
  qrSessionId: string | null;
  storeId: string;
  status: CartStatus;
  lastSeen: Date;
  createdAt: Date;
  updatedAt: Date;
  store?: Store;
}

// ─── Shopping List ─────────────────────────────────────────────────────────────

export interface ShoppingList {
  id: string;
  name: string;
  userId: string | null;
  guestSessionId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  permanentDeleteAt?: Date | null;
  items?: ListItem[];
}

export interface ListItem {
  id: string;
  name: string;
  quantity: number;
  price?: number;
  category: string | null;
  isCollected: boolean;
  collectedAt: Date | null;
  listId: string;
}

// ─── Cart Session ──────────────────────────────────────────────────────────────

export type SessionStatus = 'ACTIVE' | 'DISCONNECTED' | 'COMPLETED' | 'CHECKED_OUT';

export interface CartSession {
  id: string;
  cartId: string;
  userId: string | null;
  guestSessionId?: string | null;
  listId: string;
  status: SessionStatus;
  startedAt: Date;
  endedAt: Date | null;
  qrCode: string | null;
  externalSessionId: string | null;
  shoppingList?: ShoppingList;
  cart?: Cart;
}

// ─── Receipt ───────────────────────────────────────────────────────────────────

export type ReceiptStatus = 'DRAFT' | 'LOCKED' | 'PAID' | 'CANCELLED';
export type PaymentMethod = 'CARD' | 'CASH' | 'MOBILE' | 'WALLET';
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export interface Receipt {
  id: string;
  sessionId: string;
  userId: string | null;
  guestSessionId?: string | null;
  status: ReceiptStatus;
  subtotal: number;
  tax: number;
  total: number;
  createdAt: Date;
  lockedAt: Date | null;
  paidAt?: Date | null;
  paymentId: string | null;
  storeId: string | null;
  cartId: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  items?: ReceiptItem[];
  store?: Store;
}

export interface ReceiptItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  category: string | null;
  receiptId: string;
  scannedAt: Date;
}

// ─── Product ───────────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  category: string;
  emoji: string | null;
  price: number;
  popularity: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductFinderTab = 'popular' | 'recent' | 'favorites';

export interface ProductSearchResult {
  id: string;
  name: string;
  category: string;
  emoji: string | null;
  price: number;
  popularity: number;
}

export interface ProductCategorySummary {
  name: string;
  count: number;
}

// ─── User Stats (Analytics) ────────────────────────────────────────────────────

export interface UserStats {
  id: string;
  userId: string;
  totalOrders: number;
  totalSpent: number;
  averageBasketValue: number;
}

// ─── User Favorite Product ─────────────────────────────────────────────────────

export interface UserFavoriteProduct {
  id: string;
  userId: string;
  productId: string;
  purchaseCount: number;
  lastPurchased: Date;
  product?: Product;
}

// ─── Wishlist ──────────────────────────────────────────────────────────────────

export interface Wishlist {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  items?: WishlistItem[];
}

export interface WishlistItem {
  id: string;
  wishlistId: string;
  productId: string;
  addedAt: Date;
  note: string | null;
  product?: Product;
}

// ─── Notification ──────────────────────────────────────────────────────────────

export type NotificationType =
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'RECEIPT_READY'
  | 'SESSION_STARTED'
  | 'SESSION_ENDED'
  | 'WISHLIST_PRICE_DROP'
  | 'SYSTEM';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  data: Record<string, any> | null;
  createdAt: Date;
}

// ─── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateListDTO {
  name: string;
}

export interface CreateListItemDTO {
  name: string;
  quantity?: number;
  price?: number;
  category?: string;
}

export interface UpdateListItemDTO {
  name?: string;
  quantity?: number;
  price?: number;
  category?: string;
  isCollected?: boolean;
}

export interface LinkCartDTO {
  cartCode: string;
  pairingCode: string;
  listId: string;
}

export interface UpdateReceiptItemDTO {
  quantity?: number;
  remove?: boolean;
}

export interface AddWishlistItemDTO {
  productId: string;
  note?: string;
}

export interface AddFavoriteDTO {
  productId: string;
}

// ─── API Response ──────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Session State (Zustand) ───────────────────────────────────────────────────

export interface SessionState {
  session: CartSession | null;
  receipt: Receipt | null;
  progress: {
    total: number;
    collected: number;
    remaining: number;
  };
  isConnected: boolean;
}
