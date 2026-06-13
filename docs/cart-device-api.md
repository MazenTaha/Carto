# Cart Device API

## Overview

Carto uses a backend-mediated pairing flow for physical carts and Raspberry Pi screens.

Customer WebApp:
- stores shopping lists in PostgreSQL through Prisma
- scans a cart QR code that contains cart identity only
- calls `POST /api/cart/link`

Cart device:
- shows a QR code for its cart
- polls the backend using its `deviceSecret`
- receives the active session, selected list, and live receipt from the backend

## Local Test Cart

The seed/setup logic provisions the canonical demo cart:

```text
cartCode: cart-01
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
GET /api/carts/cart-01/qrcode
Authorization: Bearer dev-device-secret
```

4. The QR payload contains only cart pairing data:

```json
{
  "type": "cart_pairing",
  "cartCode": "cart-01",
  "pairingCode": "123456"
}
```

5. The shopper scans that QR in the WebApp and confirms the selected list.
6. The WebApp calls:

```http
POST /api/cart/link
Content-Type: application/json
```

```json
{
  "listId": "clist123",
  "cartCode": "cart-01",
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

All cart-device endpoints require:

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
GET /api/carts/cart-01/active-session
Authorization: Bearer <deviceSecret>
```

### Add Scanned Item

```text
POST /api/carts/cart-01/items
Authorization: Bearer <deviceSecret>
Content-Type: application/json
```

### Remove Scanned Item

```text
POST /api/carts/cart-01/items/remove
Authorization: Bearer <deviceSecret>
Content-Type: application/json
```

### Close Session

```text
POST /api/carts/cart-01/close-session
Authorization: Bearer <deviceSecret>
```

### Reset Cart

```text
POST /api/carts/cart-01/reset
```

### Device Status

```text
GET /api/carts/cart-01/status
GET /api/carts/cart-01/status
Authorization: Bearer <deviceSecret>
```

## QR Generation

Public dev/demo route:

```text
GET /api/cart/qrcode?cartCode=cart-01
```

Device-authenticated per-cart route:

```text
GET /api/carts/cart-01/qrcode
Authorization: Bearer dev-device-secret
```

Response:

```json
{
  "success": true,
  "data": {
    "payload": {
      "type": "cart_pairing",
      "cartCode": "cart-01",
      "pairingCode": "123456"
    },
    "qrValue": "{\"type\":\"cart_pairing\",\"cartCode\":\"cart-01\",\"pairingCode\":\"123456\"}",
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

## Local End-to-End Test Checklist

1. Run `npx prisma generate`.
2. Run `npx prisma migrate deploy`.
3. Seed the demo data with `npx prisma db seed`.
4. Start the app.
5. Open `/device-simulator` or `/device/cart-01` and use `dev-device-secret`.
6. Generate or display the QR for `cart-01`.
7. Open `/session/start?listId=<listId>` and scan the cart QR.
8. Confirm the selected list and complete `POST /api/cart/link`.
9. Verify the cart device receives the assigned list from `GET /api/carts/cart-01/active-session`.

## Current Limitations

- Device checkout is not the real customer payment flow.
- The real customer payment flow continues through the web payment step and Paymob confirmation.
