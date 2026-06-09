# Friend Device Demo

## Public Demo Values

```text
Vercel backend URL: https://cartovercel1.vercel.app
CARTO_API_BASE_URL=https://cartovercel1.vercel.app
CARTO_WEB_BASE_URL=https://cartovercel1.vercel.app
CART_CODE=CART-001
DEVICE_SECRET=dev-device-secret
```

Use the backend base URL only. Do not point the cart app at `/auth/signin`.

## Architecture

```text
Phone / Carto WebApp
-> Vercel Carto backend API
-> Neon / PostgreSQL
-> Cart / Raspberry Pi app polling backend API
```

Important rules:
- The cart device must not call `POST /api/cart/link`.
- The cart device must not connect directly to Neon.
- The QR code must not contain shopping list data.
- The `deviceSecret` must stay only in the `Authorization` header.

## Correct Device Endpoints

QR endpoint:

```http
GET /api/carts/CART-001/qrcode
Authorization: Bearer dev-device-secret
```

Active-session endpoint:

```http
GET /api/carts/CART-001/active-session
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
  "cartCode": "CART-001",
  "pairingCode": "123456"
}
```

## QR Payload Rules

The QR payload must stay limited to temporary pairing data:

```json
{
  "type": "cart_pairing",
  "cartCode": "CART-001",
  "pairingCode": "123456"
}
```

Do not put the shopping list in the QR.

## Active Session Response Shape

The teammate cart app should read:

```text
data.shoppingList.items
```

Waiting shape:

```json
{
  "success": true,
  "data": {
    "active": false,
    "status": "waiting",
    "cartCode": "CART-001",
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
    "cartCode": "CART-001",
    "cartStatus": "IN_USE",
    "cartSessionId": "cs_123",
    "sessionId": "cs_123",
    "receiptId": "rcpt_123",
    "shoppingList": {
      "id": "list_123",
      "name": "Weekly Groceries",
      "items": [
        {
          "id": "item_1",
          "name": "Milk",
          "quantity": 1,
          "price": 0,
          "category": "Dairy & Eggs",
          "checked": false
        }
      ]
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

Add item:

```http
POST /api/carts/CART-001/items
Authorization: Bearer dev-device-secret
Content-Type: application/json
```

```json
{
  "name": "Coca Cola",
  "price": 35,
  "quantity": 1,
  "category": "Drinks"
}
```

Remove item:

```http
POST /api/carts/CART-001/items/remove
Authorization: Bearer dev-device-secret
Content-Type: application/json
```

```json
{
  "name": "Coca Cola",
  "quantity": 1
}
```

Checkout:

```http
POST /api/carts/CART-001/checkout
Authorization: Bearer dev-device-secret
```

This is mock device checkout for demo only.

Close session:

```http
POST /api/carts/CART-001/close-session
Authorization: Bearer dev-device-secret
```

Reset cart:

```http
POST /api/carts/CART-001/reset
```

In production, reset is admin-protected.

## Demo Flow

Phone:
1. Open `https://cartovercel1.vercel.app/auth/signin`.
2. Sign in or continue as guest.
3. Create or select a shopping list.
4. Open connect-cart flow.
5. Scan the QR shown by the cart app.
6. Confirm sending the list to `CART-001`.
7. The WebApp calls `POST /api/cart/link`.
8. The phone redirects to the live session page.

Device:
1. Call `GET /api/carts/CART-001/qrcode`.
2. Show the returned QR.
3. Poll `GET /api/carts/CART-001/active-session` every 2 seconds.
4. When it switches to `active`, render `data.shoppingList.items`.
5. Use add/remove endpoints as scan events happen.
6. When the trip ends, call checkout or close-session.
7. When the backend returns `waiting` again, go back to QR mode.

## Reset / Finish Behavior

- `POST /api/carts/CART-001/close-session` ends the active cart session and frees the cart.
- `POST /api/carts/CART-001/checkout` performs mock payment, ends the session, and frees the cart.
- `POST /api/carts/CART-001/reset` can be used to recover a stuck demo cart.
- After any of these, `GET /api/carts/CART-001/active-session` should return waiting.

## Demo Readiness Route

```http
GET /api/demo/device-readiness?cartCode=CART-001
```

This route is safe to share because it does not expose secrets. It reports:
- backend status
- database status
- whether the cart exists
- cart status
- whether the cart has a device secret
- whether an active session exists
- endpoint paths
- warnings

## CORS Notes

Native apps and server-side device clients do not need browser CORS.

If the teammate tests from Expo Web or another browser origin, set:

```text
CART_DEVICE_ALLOWED_ORIGINS=[http://localhost:8081,http://localhost:19006,https://cartovercel1.vercel.app]
```

Device API routes support `OPTIONS` preflight and still require:

```http
Authorization: Bearer <deviceSecret>
```

## Troubleshooting

- If QR and active-session both return database errors on Vercel, check that `DATABASE_URL` is set in Vercel and redeploy.
- If device auth fails, confirm the cart really has `deviceSecret` stored in the database.
- If `CART-001` is missing, run production migrations and seed the production database.
- If the cart stays stuck in `IN_USE`, use close-session or reset before the next demo run.
- If a browser-based device client gets blocked, set `CART_DEVICE_ALLOWED_ORIGINS` and redeploy.

## Production Setup Commands

Use these from a shell that points at the production database:

```bash
npx prisma migrate deploy
npx prisma db seed
```

The seed upserts:
- `admin@gmail.com`
- `CART-001`
- `dev-device-secret`
- `AVAILABLE` cart status

## Production Admin Login

For the deployed Vercel app, admin access is not granted just because a user exists in the database. The admin email must also be present in `ADMIN_EMAILS`.

To create real admin login rows in the production database without reseeding everything else:

```bash
ADMIN_EMAILS="admin@example.com" ADMIN_SEED_PASSWORD="set-a-real-password" npm run db:seed:admins
```

On Windows PowerShell:

```powershell
$env:ADMIN_EMAILS="admin@example.com"
$env:ADMIN_SEED_PASSWORD="set-a-real-password"
npm run db:seed:admins
```

Keep `ADMIN_EMAILS` set in Vercel after that. `ADMIN_SEED_PASSWORD` is only needed when creating or rotating the database password for those admin users.
