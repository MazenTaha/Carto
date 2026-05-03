# Carto - Smart Shopping Cart System

A comprehensive Next.js application for managing smart shopping carts with real-time tracking, virtual receipts, and secure checkout.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with credentials, Google OAuth, Firebase phone OTP, and guest access
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Payment**: Stripe (sandbox)

## Features

- User authentication (email/password, Google OAuth, Egyptian phone OTP, guest mode)
- Shopping list management (CRUD)
- QR code cart linking
- Device-protected cart display endpoint for assigned lists
- Real-time session tracking
- Virtual receipt with live updates
- Secure checkout and payment flow

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

3. Configure your `.env` file with:
- Database URL
- NextAuth URL and secret
- Google OAuth credentials
- Firebase client and Admin credentials for phone OTP
- Stripe keys (optional for sandbox)

Required authentication variables:

```env
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
NEXT_PUBLIC_FIREBASE_API_KEY="your-firebase-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-firebase-project-id"
NEXT_PUBLIC_FIREBASE_APP_ID="your-firebase-app-id"
FIREBASE_PROJECT_ID="your-firebase-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

4. Set up the database:
```bash
npx prisma generate
npx prisma migrate dev
```

For quick demo databases you can use `npx prisma db push` instead of migrations.

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### iPhone Camera Testing

The QR scanner needs HTTPS on phones. A local network URL like `http://192.168.x.x:3000` will load the app, but iOS will block camera access.

For the easiest mobile test, run Carto and a secure tunnel in two terminals:

```bash
npm run dev
npm run tunnel
```

Open the generated `https://...loca.lt` URL on the iPhone. If `NEXTAUTH_URL` is set in `.env`, set it to that HTTPS tunnel URL and restart the dev server.

You can also run local HTTPS with:

```bash
npm run dev:https
```

Then open the shown `https://<your-computer-ip>:3000` URL on the iPhone and trust the local development certificate if iOS asks.

## Project Structure

```
/app
  /auth          # Authentication pages
  /dashboard     # Main dashboard
  /lists         # Shopping list management
  /session       # Active shopping session
  /device        # Development cart/device display
  /checkout      # Checkout and payment
/api
  /lists         # List API routes
  /sessions      # Session API routes
  /cart          # Cart linking API
  /payment       # Payment API routes
/prisma          # Database schema
/components      # Reusable React components
/lib             # Utilities and helpers
/types           # TypeScript type definitions
```

## Database Schema

- **User**: User accounts and authentication
- **GuestSession**: Database-backed guest sessions referenced by the `guest_session_id` HTTP-only cookie
- **ShoppingList**: User or guest-owned shopping lists
- **ListItem**: Items in shopping lists
- **CartSession**: User or guest-owned active shopping sessions
- **Receipt**: User or guest-owned virtual receipts
- **ReceiptItem**: Items in receipts

## Cart Device Linking

Cart QR codes contain only pairing data, not shopping list contents:

```json
{
  "type": "cart_pairing",
  "cartCode": "CART-001",
  "pairingCode": "123456"
}
```

After a shopper selects a list and scans the QR, `/api/cart/link` verifies ownership and pairing, creates the `CartSession` and draft `Receipt`, and marks the cart `IN_USE`. A cart/device fetches its assigned list from `/api/carts/[cartCode]/active-session` with `Authorization: Bearer <deviceSecret>`.

For local testing, the seed script creates `CART-001` with `deviceSecret` set to `dev-device-secret`.

## Guest Mode

Guest mode is production-safe for serverless deployments. Clicking **Continue as Guest** creates a `GuestSession` row in PostgreSQL and sets an HTTP-only `guest_session_id` cookie. Guest shopping lists, cart sessions, and receipts are scoped to that database session; no guest data is stored in cookies or local JSON files, and the app should not create `guest_data.json`.

After changing the Prisma schema, run:

```bash
npx prisma generate
npx prisma migrate dev
```

Use `npx prisma db push` only for throwaway/demo environments.

## License

This project is created for academic purposes.

"# Carto" 
