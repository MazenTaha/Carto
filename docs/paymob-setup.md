# Paymob Setup

Carto now uses a real Paymob hosted checkout flow in EGP.

## Required environment variables

Add these server-side variables:

```env
PAYMOB_API_KEY=...
PAYMOB_INTEGRATION_ID=...
PAYMOB_IFRAME_ID=...
PAYMOB_HMAC_SECRET=...
```

Optional overrides:

```env
PAYMOB_API_BASE_URL=https://accept.paymob.com/api
PAYMOB_HOSTED_BASE_URL=https://accept.paymob.com
```

## Redirects and callbacks

Configure Paymob to use these Carto URLs:

- Return / response callback: `https://your-domain.com/payment/pending`
- Webhook / processed callback: `https://your-domain.com/api/payments/paymob/webhook`

The pending page polls Carto's backend until the Paymob webhook confirms success or failure.

## Checkout flow

1. Customer finishes shopping and reaches `/session/ready`.
2. `Scan payment QR` validates a Carto-issued QR token and then opens Paymob.
3. `Bypass scan` skips only the QR step and still opens Paymob.
4. Paymob handles the real hosted checkout in EGP.
5. Carto marks the receipt as paid only after the Paymob webhook confirms the transaction.

## Notes

- Frontend redirects never mark a receipt as paid.
- Device-auth checkout is intentionally disabled for production-safe payment flow.
- Receipt history only shows receipts that reached the real paid state.
