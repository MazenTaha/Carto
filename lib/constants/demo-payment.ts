export const DEMO_PAYMENT_AMOUNT_EGP = 1.0;
export const DEMO_PAYMENT_AMOUNT_CENTS = 100;
export const DEMO_PAYMENT_CURRENCY = 'EGP';

export function getDemoPaymentAmount() {
  return {
    amount: DEMO_PAYMENT_AMOUNT_EGP,
    amountCents: DEMO_PAYMENT_AMOUNT_CENTS,
    currency: DEMO_PAYMENT_CURRENCY,
  };
}
