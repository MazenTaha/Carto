import {
  DEMO_PAYMENT_AMOUNT_CENTS,
  DEMO_PAYMENT_AMOUNT_EGP,
  DEMO_PAYMENT_CURRENCY,
} from '@/lib/constants/demo-payment';

export const PAYMOB_CURRENCY = DEMO_PAYMENT_CURRENCY;

export function amountToCents(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100);
}

export function toPaymobAmountCents(amountEGP: number) {
  return amountToCents(amountEGP);
}

export function centsToAmount(amountCents: number) {
  return amountCents / 100;
}

function normalizeMoneyAmount(amount: number | null | undefined) {
  return Number.isFinite(amount) ? Number(amount) : 0;
}

export function getCheckoutAmountEGP(receipt: { total: number | null | undefined }) {
  const actualReceiptTotal = normalizeMoneyAmount(receipt.total);

  return {
    amount: DEMO_PAYMENT_AMOUNT_EGP,
    amountCents: DEMO_PAYMENT_AMOUNT_CENTS,
    actualReceiptTotal,
    demoAmountFallback: true,
    fallbackAllowed: true,
  };
}

export function getPaymobAmountMinorUnits(receipt: { total: number | null | undefined }) {
  const checkoutAmount = getCheckoutAmountEGP(receipt);

  return {
    ...checkoutAmount,
    amountMinorUnits: toPaymobAmountCents(checkoutAmount.amount),
  };
}

export function formatCurrencyEGP(amount: number) {
  return `EGP ${normalizeMoneyAmount(amount).toFixed(2)}`;
}

export function formatPaymentCurrency(amount: number, currency = PAYMOB_CURRENCY) {
  if ((currency || '').toUpperCase() === PAYMOB_CURRENCY) {
    return formatCurrencyEGP(amount);
  }

  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
