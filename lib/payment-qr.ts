import { createHmac, timingSafeEqual } from 'crypto';
import { getAuthSecret } from '@/lib/auth-secret';

type PaymentQrTokenInput = {
  sessionId: string;
  receiptId?: string | null;
};

function buildPaymentQrPayload({ sessionId, receiptId }: PaymentQrTokenInput) {
  return `${sessionId}:${receiptId ?? ''}`;
}

export function createPaymentQrToken(input: PaymentQrTokenInput) {
  return createHmac('sha256', getAuthSecret())
    .update(buildPaymentQrPayload(input))
    .digest('hex');
}

export function validatePaymentQrToken(input: PaymentQrTokenInput, token: string) {
  const providedToken = token.trim();

  if (!providedToken) {
    return false;
  }

  const expectedToken = createPaymentQrToken(input);

  try {
    return timingSafeEqual(Buffer.from(providedToken, 'utf8'), Buffer.from(expectedToken, 'utf8'));
  } catch {
    return false;
  }
}
