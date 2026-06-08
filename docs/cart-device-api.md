# Cart Device API

## Overview
Carto uses a backend-mediated pairing flow for physical carts and Raspberry Pi screens.

Customer WebApp:
- stores shopping lists in PostgreSQL through Prisma
- scans a cart QR code that contains cart identity only
- calls `POST /api/cart/link`

Raspberry Pi / cart screen:
- shows a QR code for its cart
- polls the backend using its `deviceSecret`
- receives the active session, selected list, and live receipt from the backend

The WebApp does not send the shopping list directly to the Raspberry Pi.

## Local Test Cart
The seed script creates a demo cart:

```text
cartCode: CART-001
deviceSecret: dev-device-secret
status: AVAILABLE
store: Carto Demo Store
```

Run:

```bash
npx prisma db seed
```

## Pairing Flow
1. Create or select a shopping list from the website.
2. Open `/session/start?listId=<listId>`.
3. The cart device generates a QR payload from:

```text
GET /api/carts/CART-001/qrcode
Authorization: Bearer dev-device-secret
```

4. The QR payload contains only cart pairing data:

```json
{
  "type": "cart_pairing",
  "cartCode": "CART-001",
  "pairingCode": "123456"
}
```

5. The shopper scans that QR in the WebApp and confirms the selected list.
6. The WebApp calls:

```http
POST /api/cart/link
Content-Type: application/json
Cookie: guest_session_id=...   or normal auth session cookies
```

```json
{
  "listId": "clist123",
  "cartCode": "CART-001",
  "pairingCode": "123456"
}
```

7. The backend verifies:
- authenticated user or valid guest session
- list ownership
- cart existence
- pairing code match
- pairing code expiry
- cart availability

8. The backend creates a `CartSession`, creates a draft `Receipt`, and marks the cart `IN_USE`.

## Device Authentication
All Raspberry Pi / cart-device endpoints require:

```http
Authorization: Bearer <deviceSecret>
```

Example:

```http
Authorization: Bearer dev-device-secret
```

## Endpoints

### Active Session

```text
GET /api/carts/[cartCode]/active-session
Authorization: Bearer <deviceSecret>
```

Waiting response:

```json
{
  "success": true,
  "data": {
    "status": "waiting",
    "active": false,
    "cartCode": "CART-001",
    "cart": {
      "cartCode": "CART-001",
      "status": "AVAILABLE"
    }
  }
}
```

Active response:

```json
{
  "success": true,
  "data": {
    "status": "active",
    "active": true,
    "cartCode": "CART-001",
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
    "paymentStatus": "PENDING",
    "cart": {
      "cartCode": "CART-001",
      "status": "IN_USE"
    },
    "session": {
      "id": "cs_123",
      "status": "ACTIVE",
      "startedAt": "2026-06-08T16:00:00.000Z",
      "endedAt": null
    },
    "list": {
      "id": "list_123",
      "name": "Weekly Groceries",
      "items": []
    },
    "receipt": {
      "id": "rcpt_123",
      "status": "DRAFT",
      "subtotal": 0,
      "tax": 0,
      "total": 0,
      "items": []
    }
  }
}
```

### Add Scanned Item

```text
POST /api/carts/[cartCode]/items
Authorization: Bearer <deviceSecret>
Content-Type: application/json
```

Request:

```json
{
  "productId": "prod_123",
  "name": "Milk",
  "price": 42,
  "quantity": 1,
  "category": "Dairy & Eggs"
}
```

Notes:
- `productId` is optional
- `name` is optional only if `productId` is provided
- the current schema stores receipt items by name, price, quantity, and category

### Remove Scanned Item

```text
POST /api/carts/[cartCode]/items/remove
Authorization: Bearer <deviceSecret>
Content-Type: application/json
```

Request:

```json
{
  "productId": "prod_123",
  "name": "Milk",
  "quantity": 1
}
```

### Mock Device Checkout

```text
POST /api/carts/[cartCode]/checkout
Authorization: Bearer <deviceSecret>
```

This is a mock/device checkout for development only. It marks the current receipt as paid, ends the session, and frees the cart.

Response shape:

```json
{
  "success": true,
  "data": {
    "cartCode": "CART-001",
    "cartSessionId": "cs_123",
    "receiptId": "rcpt_123",
    "items": [],
    "subtotal": 0,
    "tax": 0,
    "total": 0,
    "paymentStatus": "MOCK_PAID",
    "note": "Mock device checkout only. Replace with real payment confirmation before production use."
  }
}
```

### Close Session

```text
POST /api/carts/[cartCode]/close-session
Authorization: Bearer <deviceSecret>
```

This ends the active session without performing mock device payment. It finalizes the session/receipt through the existing session logic and frees the cart.

### Cart Status

Public:

```text
GET /api/carts/[cartCode]/status
```

Public response includes only safe information:
- `cartCode`
- `status`
- `isAvailable`
- `hasActiveSession`

Device-authenticated:

```text
GET /api/carts/[cartCode]/status
Authorization: Bearer <deviceSecret>
```

Authenticated response additionally includes:
- `activeSessionId`
- `receiptId`
- `lastSeen`

## QR Generation

Public dev/demo route:

```text
GET /api/cart/qrcode?cartCode=CART-001
```

Device-authenticated per-cart route:

```text
GET /api/carts/CART-001/qrcode
Authorization: Bearer dev-device-secret
```

Response:

```json
{
  "success": true,
  "data": {
    "payload": {
      "type": "cart_pairing",
      "cartCode": "CART-001",
      "pairingCode": "123456"
    },
    "qrValue": "{\"type\":\"cart_pairing\",\"cartCode\":\"CART-001\",\"pairingCode\":\"123456\"}",
    "expiresAt": "2026-06-08T16:05:00.000Z"
  }
}
```

The QR never contains:
- shopping list data
- user data
- guest data
- receipt data
- `deviceSecret`

## Raspberry Pi Polling Behavior
Recommended loop:

1. Boot cart screen.
2. Authenticate with `deviceSecret`.
3. Generate QR while cart is idle.
4. Poll `GET /api/carts/[cartCode]/active-session` every 2-5 seconds.
5. When response changes from `waiting` to `active`, render the assigned shopping list.
6. Call item add/remove endpoints as scans happen.
7. Call checkout or close-session when the trip ends.

## curl Examples

Check active session:

```bash
curl -H "Authorization: Bearer dev-device-secret" ^
  http://localhost:3000/api/carts/CART-001/active-session
```

Add item:

```bash
curl -X POST ^
  -H "Authorization: Bearer dev-device-secret" ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"Milk\",\"price\":42,\"quantity\":1,\"category\":\"Dairy & Eggs\"}" ^
  http://localhost:3000/api/carts/CART-001/items
```

Remove item:

```bash
curl -X POST ^
  -H "Authorization: Bearer dev-device-secret" ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"Milk\",\"quantity\":1}" ^
  http://localhost:3000/api/carts/CART-001/items/remove
```

Mock checkout:

```bash
curl -X POST ^
  -H "Authorization: Bearer dev-device-secret" ^
  http://localhost:3000/api/carts/CART-001/checkout
```

Close session:

```bash
curl -X POST ^
  -H "Authorization: Bearer dev-device-secret" ^
  http://localhost:3000/api/carts/CART-001/close-session
```

## Local End-to-End Test Checklist
1. Run `npm install` if dependencies are missing.
2. Configure `.env` with a working `DATABASE_URL` and auth secrets.
3. Run `npx prisma generate`.
4. Run `npx prisma migrate deploy` or your normal local migration command.
5. Seed the demo data with `npx prisma db seed`.
6. Start the app with `npm run dev:lan`.
7. Open the website, sign in or continue as guest.
8. Create a shopping list and add at least one item.
9. Open `/device-simulator` or `/device/CART-001` and use `dev-device-secret`.
10. Generate or display the QR for `CART-001`.
11. Open `/session/start?listId=<listId>` and scan the cart QR.
12. Confirm the selected list and complete `POST /api/cart/link`.
13. Verify the cart device receives the assigned list from `GET /api/carts/CART-001/active-session`.
14. If needed, test:
    - `POST /api/carts/CART-001/items`
    - `POST /api/carts/CART-001/items/remove`
    - `POST /api/carts/CART-001/checkout`
    - `POST /api/carts/CART-001/close-session`
15. Open `/admin` and confirm cart/session state updates.

## Current Limitations
- The QR flow is production-oriented, but the device simulator is still a web page.
- Device item updates currently store receipt items by name, not by a persisted `productId` on `ReceiptItem`.
- Device checkout is mock-only and should not be treated as real payment processing.
- Shopper checkout still uses the existing website flow and remains supported.
