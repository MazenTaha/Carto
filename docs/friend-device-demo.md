# Friend Device Demo

## Public Demo Values

```text
EXPO_PUBLIC_CARTO_API_BASE_URL=https://cartovercel1.vercel.app
EXPO_PUBLIC_CART_CODE=cart-01
EXPO_PUBLIC_DEVICE_SECRET=dev-device-secret
```

Use the backend base URL only. Do not point the cart app at `/auth/signin`.

## Safety Rules

- The cart device must not call `POST /api/cart/link`.
- The cart device must not connect directly to Neon/Postgres.
- The QR code must not contain `deviceSecret`.
- The `deviceSecret` must stay only in the `Authorization` header.

## Correct Device Endpoints

QR endpoint:

```http
GET /api/carts/cart-01/qrcode
Authorization: Bearer dev-device-secret
```

Active-session endpoint:

```http
GET /api/carts/cart-01/active-session
Authorization: Bearer dev-device-secret
```

Phone/WebApp endpoint:

```http
POST /api/cart/link
Content-Type: application/json
```

```json
{
  "listId": "selected-shopping-list-id",
  "cartCode": "cart-01",
  "pairingCode": "123456"
}
```

## QR Payload Rules

The QR payload must stay limited to temporary pairing data:

```json
{
  "type": "cart_pairing",
  "cartCode": "cart-01",
  "pairingCode": "123456"
}
```

Do not put the shopping list in the QR.

## Active Session Response Shape

Waiting shape:

```json
{
  "success": true,
  "data": {
    "active": false,
    "status": "waiting",
    "cartCode": "cart-01",
    "cartStatus": "AVAILABLE"
  }
}
```

Active shape:

```json
{
  "success": true,
  "data": {
    "active": true,
    "status": "active",
    "cartCode": "cart-01",
    "cartStatus": "IN_USE",
    "cartSessionId": "cs_123",
    "sessionId": "cs_123",
    "receiptId": "rcpt_123",
    "shoppingList": {
      "id": "list_123",
      "name": "Weekly Groceries",
      "items": []
    },
    "cartItems": [],
    "total": 0,
    "receipt": {
      "id": "rcpt_123",
      "total": 0,
      "items": []
    }
  }
}
```

## Device Mutating Endpoints

```http
POST /api/carts/cart-01/items
POST /api/carts/cart-01/items/remove
POST /api/carts/cart-01/close-session
POST /api/carts/cart-01/reset
```

`POST /api/carts/cart-01/checkout` is intentionally not part of the real customer payment flow.

## Demo Flow

Phone:
1. Open the Carto WebApp.
2. Sign in or continue as guest.
3. Create or select a shopping list.
4. Open the connect-cart flow.
5. Scan the QR shown by the cart app.
6. Confirm sending the list to `cart-01`.
7. The WebApp calls `POST /api/cart/link`.
8. The phone redirects to the live session/payment flow.

Device:
1. Call `GET /api/carts/cart-01/qrcode`.
2. Show the returned QR.
3. Poll `GET /api/carts/cart-01/active-session` every 2 seconds.
4. When it switches to `active`, render `data.shoppingList.items`.
5. Use add/remove endpoints as scan events happen.
6. Call `close-session` or `reset` when the trip ends.
7. When the backend returns `waiting` again, go back to QR mode.

## Demo Readiness Route

```http
GET /api/demo/device-readiness?cartCode=cart-01
```

This route is safe to share because it does not expose secrets. It reports whether the cart exists, whether a device secret is stored, and which safe endpoints the device should call.

## Troubleshooting

- If QR and active-session both return database errors on Vercel, check `DATABASE_URL` and redeploy.
- If device auth fails, confirm the cart really has a `deviceSecret` stored in the database.
- If `cart-01` is missing, run production migrations and seed the production database.
- If the cart stays stuck in `IN_USE`, use close-session or reset before the next demo run.

## Production Setup Commands

```bash
npx prisma migrate deploy
npx prisma db seed
```

The seed upserts:
- `admin@gmail.com`
- `cart-01`
- `dev-device-secret`
- `AVAILABLE` cart status
