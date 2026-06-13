export const PAYMOB_CURRENCY = 'EGP';

export function amountToCents(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100);
}

export function centsToAmount(amountCents: number) {
  return amountCents / 100;
}

export function formatPaymentCurrency(amount: number, currency = PAYMOB_CURRENCY) {
  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
