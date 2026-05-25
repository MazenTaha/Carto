// Admin Dashboard — TypeScript types

// ─── KPI Stats ────────────────────────────────────────────────────────────────

export interface AdminStats {
  totalCarts: number;
  activeSessions: number;
  completedSessions: number;
  totalUsers: number;
  totalGuestSessions: number;
  totalReceipts: number;
  todayRevenue: number;
  cartsOnline: number;
  cartsOffline: number;
  cartsInUse: number;
  cartsAvailable: number;
  cartsMaintenance: number;
  recentSessions: AdminSessionRow[];
  activityFeed: ActivityEvent[];
}

export interface ActivityEvent {
  id: string;
  type: 'session_started' | 'session_ended' | 'cart_offline' | 'payment_completed' | 'user_registered';
  message: string;
  timestamp: string;
  meta?: Record<string, string | number>;
}

// ─── Admin Product ────────────────────────────────────────────────────────────

export interface AdminProduct {
  id: string;
  name: string;
  category: string;
  emoji: string | null;
  price: number;
  popularity: number;
  barcode?: string;          // UI-only (not in DB schema)
  image?: string;            // UI-only
  stock?: number;            // UI-only
  createdAt: string;
  updatedAt: string;
}

export interface AdminProductsResponse {
  data: AdminProduct[];
  total: number;
  page: number;
  pageSize: number;
}

export type CreateProductInput = {
  name: string;
  category: string;
  emoji?: string;
  price: number;
  popularity?: number;
};

export type UpdateProductInput = Partial<CreateProductInput> & { id: string };

// ─── Admin Cart ───────────────────────────────────────────────────────────────

export type CartStatus = 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'OFFLINE';

export interface AdminCart {
  id: string;
  cartCode: string;
  bluetoothName: string | null;
  deviceSecret: string | null;
  hasDeviceSecret?: boolean;
  status: CartStatus;
  lastSeen: string;
  createdAt: string;
  storeId: string;
  storeName?: string;
  isOnline?: boolean;
  currentSession?: AdminSessionRow | null;
}

// ─── Admin Session ────────────────────────────────────────────────────────────

export type SessionStatus = 'ACTIVE' | 'DISCONNECTED' | 'COMPLETED' | 'CHECKED_OUT';

export interface AdminSessionRow {
  id: string;
  cartCode: string;
  cartId: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  guestSessionId: string | null;
  listName: string;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  durationSeconds?: number;
  itemCount?: number;
  collectedCount?: number;
  total?: number;
  receiptStatus?: string | null;
  paymentStatus?: string | null;
}

// ─── Admin User ───────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  phoneNumber: string | null;
  createdAt: string;
  totalSessions: number;
  totalSpent: number;
  isGuest: boolean;
  isDisabled?: boolean;
}

export interface AdminUsersResponse {
  data: AdminUser[];
  total: number;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface SessionsPerDayPoint {
  date: string;
  sessions: number;
  revenue: number;
}

export interface PeakHourPoint {
  hour: string;
  sessions: number;
}

export interface TopProductPoint {
  name: string;
  scans: number;
  category: string;
}

export interface CartUtilizationPoint {
  name: string;
  value: number;
  fill: string;
}

export interface AnalyticsData {
  sessionsPerDay: SessionsPerDayPoint[];
  peakHours: PeakHourPoint[];
  topProducts: TopProductPoint[];
  cartUtilization: CartUtilizationPoint[];
  avgBasketSize: number;
  totalRevenue: number;
  totalSessions: number;
}

// ─── API Response wrapper ─────────────────────────────────────────────────────

export interface AdminApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string | { code: string; message: string };
}
