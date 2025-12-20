// Core TypeScript types for Carto application

// User types
export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Shopping List types
export interface ShoppingList {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  items?: ListItem[];
}

export interface ListItem {
  id: string;
  name: string;
  quantity: number;
  category: string | null;
  isCollected: boolean;
  collectedAt: Date | null;
  listId: string;
}

// Cart Session types
export type SessionStatus = 'ACTIVE' | 'DISCONNECTED' | 'COMPLETED' | 'CHECKED_OUT';

export interface CartSession {
  id: string;
  cartId: string;
  userId: string;
  listId: string;
  status: SessionStatus;
  startedAt: Date;
  endedAt: Date | null;
  qrCode: string | null;
  shoppingList?: ShoppingList;
}

// Receipt types
export type ReceiptStatus = 'DRAFT' | 'LOCKED' | 'PAID' | 'CANCELLED';

export interface Receipt {
  id: string;
  sessionId: string;
  userId: string;
  status: ReceiptStatus;
  subtotal: number;
  tax: number;
  total: number;
  createdAt: Date;
  lockedAt: Date | null;
  paymentId: string | null;
  items?: ReceiptItem[];
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

// DTOs for API requests/responses
export interface CreateListDTO {
  name: string;
}

export interface CreateListItemDTO {
  name: string;
  quantity?: number;
  category?: string;
}

export interface UpdateListItemDTO {
  name?: string;
  quantity?: number;
  category?: string;
  isCollected?: boolean;
}

export interface LinkCartDTO {
  cartId: string;
  listId: string;
}

export interface UpdateReceiptItemDTO {
  quantity?: number;
  remove?: boolean;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Session state for real-time updates
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

