export const PAYMOB_CURRENCY = 'EGP';

const DEFAULT_MIN_TEST_AMOUNT_EGP = 1;
const DEFAULT_ALLOW_ZERO_TOTAL_FALLBACK = true;

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

export function getPaymentMinTestAmountEGP() {
  const configured = Number(process.env.PAYMENT_MIN_TEST_AMOUNT_EGP);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MIN_TEST_AMOUNT_EGP;
}

export function isZeroTotalFallbackAllowed() {
  const raw = process.env.PAYMENT_ALLOW_ZERO_TOTAL_FALLBACK?.trim().toLowerCase();

  if (!raw) {
    return DEFAULT_ALLOW_ZERO_TOTAL_FALLBACK;
  }

  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

export function getCheckoutAmountEGP(receipt: { total: number | null | undefined }) {
  const actualReceiptTotal = normalizeMoneyAmount(receipt.total);

  if (actualReceiptTotal > 0) {
    return {
      amount: actualReceiptTotal,
      amountCents: amountToCents(actualReceiptTotal),
      actualReceiptTotal,
      demoAmountFallback: false,
      fallbackAllowed: false,
    };
  }

  const fallbackAmount = getPaymentMinTestAmountEGP();

  return {
    amount: fallbackAmount,
    amountCents: amountToCents(fallbackAmount),
    actualReceiptTotal,
    // Demo fallback so EGP 0.00 receipts can still open a real Paymob checkout while prices are unfinished.
    // TODO: Real production should charge fully calculated receipt totals from Product/ListItem/ReceiptItem pricing.
    demoAmountFallback: true,
    fallbackAllowed: isZeroTotalFallbackAllowed(),
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
