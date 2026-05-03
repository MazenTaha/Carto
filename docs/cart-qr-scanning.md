# Cart QR Scanning Flow

Carto expects the physical cart QR code to contain JSON like this:

```json
{
  "cartId": "cart-01",
  "bluetoothName": "Carto-Cart-01",
  "pairingCode": "739214",
  "sessionId": "session-temp-123"
}
```

## What Happens After Scan

1. `components/carto/QrScanner.tsx` reads the real QR code with the phone camera.
2. `app/session/start/page.tsx` parses the JSON and validates it with `cartQrPayloadSchema`.
3. The page sends the scanned payload plus the selected `listId` to `POST /api/cart/link`.
4. `app/api/cart/link/route.ts` stores or updates the physical cart in `Cart`.
5. The same route creates a new `CartSession` and draft `Receipt`.
6. The active session page shows the linked cart code, Bluetooth name, QR session ID, and store.

## Database Mapping

- QR `cartId` is stored as `Cart.cartCode`.
- QR `bluetoothName` is stored as `Cart.bluetoothName`.
- QR `pairingCode` is stored as `Cart.pairingCode`.
- QR `sessionId` is stored as `Cart.qrSessionId` and `CartSession.externalSessionId`.
- The selected shopping list is connected through `CartSession.listId`.
- The logged-in user is connected through `CartSession.userId`.
- A draft receipt is created through the `Receipt` model.

The application code prevents a cart from being linked to another user's active session, but old completed sessions are allowed. This lets the same physical cart be reused over time.

## Generate a Test QR Code

Start the app and open this endpoint while signed in:

```text
/api/cart/qrcode?cartId=cart-01&bluetoothName=Carto-Cart-01&pairingCode=739214&sessionId=session-temp-123
```

The response includes:

- `data.qrCode`: a QR image as a data URL.
- `data.qrData`: the raw JSON encoded into the QR.
- `data.payload`: the parsed payload object.

You can also create a QR code in any external QR generator by pasting the JSON payload exactly.

## Test Checklist

1. Create or select a shopping list.
2. Open the cart connection screen.
3. Scan a QR code containing the payload above.
4. Confirm the page shows the detected cart ID and Bluetooth name.
5. Press **Connect to Cart**.
6. Confirm the active session page shows the linked physical cart details.
7. Check the database tables: `carts`, `cart_sessions`, `receipts`, and `notifications`.
