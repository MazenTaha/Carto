import crypto from 'crypto';
import { getAppBaseUrl } from '@/lib/app-url';
import { centsToAmount, formatPaymentCurrency } from '@/lib/payment-money';

export const PAYMENT_QR_TOKEN_TTL_MS = 10 * 60 * 1000;

export function generateSecureToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

export function buildPaymentQrUrl(token: string, requestUrl?: string) {
  const url = new URL('/checkout/scan', getAppBaseUrl(requestUrl));
  url.searchParams.set('token', token);
  return url.toString();
}

export function createPaymentQrExpiry(ttlMs = PAYMENT_QR_TOKEN_TTL_MS) {
  return new Date(Date.now() + ttlMs);
}

export function isPaymentQrExpired(expiresAt: Date | null | undefined) {
  return Boolean(expiresAt && expiresAt.getTime() < Date.now());
}

export function formatMoney(amountCents: number, currency: string) {
  return formatPaymentCurrency(centsToAmount(amountCents), currency);
}
