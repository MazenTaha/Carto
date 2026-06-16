# Paymob Setup

Carto uses a real Paymob hosted checkout flow in EGP. The frontend never marks a receipt as paid by itself. Only the verified Paymob webhook can finalize payment.

## 1. Create and verify your Paymob merchant account

1. Sign in to the Paymob Egypt dashboard.
2. Complete business verification / KYC.
3. Configure your settlement bank or payout details in the Paymob dashboard.

Real settlement details belong in the Paymob merchant dashboard, not in `.env`.

## 2. Collect the Paymob values Carto needs

Get these values from Paymob Dashboard -> Settings -> API Keys and Payment Integrations:

- API key
- Public key
- Secret key
- Card integration ID
- HMAC secret
- Iframe ID only if you keep the legacy iframe checkout flow

## 3. Add local and Vercel environment variables

Add these variables to:

1. Local `.env`
2. Vercel Project Settings -> Environment Variables

```env
PAYMOB_API_KEY=your_paymob_api_key
PAYMOB_PUBLIC_KEY=your_paymob_public_key
PAYMOB_SECRET_KEY=your_paymob_secret_key
PAYMOB_HMAC_SECRET=your_hmac_secret
PAYMOB_INTEGRATION_ID=your_card_integration_id
PAYMOB_API_BASE_URL=https://accept.paymob.com
PAYMOB_HOSTED_BASE_URL=https://accept.paymob.com
PAYMENT_ALLOW_ZERO_TOTAL_FALLBACK=true
PAYMENT_MIN_TEST_AMOUNT_EGP=1
APP_URL=https://cartovercel1.vercel.app
NEXTAUTH_URL=https://cartovercel1.vercel.app
PAYMOB_IFRAME_ID=your_iframe_id
```

Do not commit real Paymob secrets.
Do not paste Paymob secrets into GitHub, chat, or client-side code.

## 4. Configure Paymob callback URLs

Set these URLs in the Paymob dashboard:

- Transaction processed callback / webhook:
  `https://cartovercel1.vercel.app/api/payments/paymob/webhook`
- Transaction response / redirect callback:
  `https://cartovercel1.vercel.app/payment/return`

The redirect page is only a waiting/status page. It must not mark the receipt as paid.
Keep Paymob test mode enabled while validating the integration.

## 5. Add the same values to Vercel and redeploy

After saving the same Paymob variables in Vercel Project Settings -> Environment Variables, redeploy the project so the server routes pick them up.

## 6. Deploy database changes if needed

Run:

```bash
npx prisma generate
npx prisma migrate deploy
```

## 7. Test the checkout flow

1. Create a list and link it to a cart.
2. Finish shopping and open `/session/ready`.
3. Test `Bypass scan`.
4. Test device `payment-qr`.
5. Confirm Carto opens the hosted Paymob checkout.
6. Confirm the webhook verifies HMAC and only then marks:
   - `PaymentAttempt` as paid/succeeded
   - `Receipt` as paid
   - `CartSession` as checked out
   - `Cart` as available

## 8. Demo zero-total fallback

If a receipt total is still `EGP 0.00`, Carto can use a demo fallback checkout amount of `EGP 1.00` when:

- `PAYMENT_ALLOW_ZERO_TOTAL_FALLBACK=true`
- `PAYMENT_MIN_TEST_AMOUNT_EGP=1`

This is only for testing while list/product prices are still incomplete.

## 9. Production reminder

Before real production charging:

1. Make sure receipt totals are calculated from real product/list pricing.
2. Keep the webhook HMAC secret configured.
3. Re-test the full payment flow with real positive totals.
