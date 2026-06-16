# Carto - Smart Shopping Cart System

A comprehensive Next.js application for managing smart shopping carts with real-time tracking, virtual receipts, and secure checkout.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with credentials, Google OAuth, Firebase phone OTP, and guest access
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Payment**: Paymob Egypt hosted checkout

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
- Paymob server credentials and callback URLs

Required authentication variables:

```env
AUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
ADMIN_EMAILS="admin@example.com"
NEXT_PUBLIC_FIREBASE_API_KEY="your-firebase-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-firebase-project-id"
NEXT_PUBLIC_FIREBASE_APP_ID="your-firebase-app-id"
FIREBASE_PROJECT_ID="your-firebase-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Set either `AUTH_SECRET` or `NEXTAUTH_SECRET`; `AUTH_SECRET` is preferred. Only variables prefixed with `NEXT_PUBLIC_` should be used in browser code.

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

### Paymob Unified Checkout Environment Variables

Server-only Paymob variables:

```env
PAYMOB_API_KEY=""
PAYMOB_PUBLIC_KEY=""
PAYMOB_SECRET_KEY=""
PAYMOB_HMAC_SECRET=""
PAYMOB_INTEGRATION_ID=""
PAYMOB_API_BASE_URL="https://accept.paymob.com"
PAYMOB_HOSTED_BASE_URL="https://accept.paymob.com"
PAYMOB_IFRAME_ID=""
APP_URL="https://cartovercel1.vercel.app"
NEXTAUTH_URL="https://cartovercel1.vercel.app"
```

Keep Paymob secrets server-side only. Do not use `NEXT_PUBLIC_` for Paymob API keys, secret keys, or HMAC values.
For the newer Paymob Intention API / Unified Checkout flow, prefer `PAYMOB_SECRET_KEY` when available and keep `PAYMOB_PUBLIC_KEY` server-configured so the backend can build the final checkout redirect URL safely.

### iPhone Camera Testing

The QR scanner needs a trusted HTTPS page on iPhone Safari because it uses camera APIs. Do not open `https://192.168.x.x:3000` directly for QR scanner testing. Local IP HTTPS usually uses an invalid or self-signed certificate, so Safari shows "This Connection Is Not Private" and camera access will not be reliable.

Use a public HTTPS tunnel that forwards to your local Next.js server on port `3000`.

Terminal 1:
```bash
npm run dev
```

Terminal 2 with ngrok:
```bash
npx ngrok http 3000
```

Open the generated HTTPS forwarding URL on iPhone Safari, for example:

```bash
https://xxxx.ngrok-free.app
```

Alternative with Cloudflare Tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```

Then open the generated HTTPS URL, for example:

```bash
https://xxxx.trycloudflare.com
```

If `NEXTAUTH_URL` is set in `.env`, temporarily set it to the exact tunnel origin and restart `npm run dev`.

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
  "cartCode": "cart-01",
  "pairingCode": "123456"
}
```

After a shopper selects a list and scans the QR, `/api/cart/link` verifies ownership and pairing, creates the `CartSession` and draft `Receipt`, and marks the cart `IN_USE`. A cart/device fetches its assigned list from `/api/carts/[cartCode]/active-session` with `Authorization: Bearer <deviceSecret>`.

For local testing, the seed script creates `cart-01` with `deviceSecret` set to `dev-device-secret`.

## Guest Mode

Guest mode is production-safe for serverless deployments. Clicking **Continue as Guest** creates a `GuestSession` row in PostgreSQL and sets an HTTP-only `guest_session_id` cookie. Guest shopping lists, cart sessions, and receipts are scoped to that database session; no guest data is stored in cookies or local JSON files, and the app should not create `guest_data.json`.

After changing the Prisma schema, run:

```bash
npx prisma generate
npx prisma migrate dev
```

Use `npx prisma db push` only for throwaway/demo environments.

### Create Real Admin Logins In Production

Admin access in production is controlled by `ADMIN_EMAILS`, and the corresponding users must also exist in the database with real passwords.

Set these environment variables in the shell that points to your production database:

```env
ADMIN_EMAILS="admin1@example.com,admin2@example.com"
ADMIN_SEED_PASSWORD="set-a-real-temporary-password-here"
```

Then run:

```bash
npm run db:seed:admins
```

This upserts a real database user for each email in `ADMIN_EMAILS` and assigns the password from `ADMIN_SEED_PASSWORD`.

On Vercel, make sure these are also set:

```env
DATABASE_URL="..."
NEXTAUTH_URL="https://your-deployed-app.vercel.app"
AUTH_SECRET="..."
ADMIN_EMAILS="admin1@example.com,admin2@example.com"
```

Only `ADMIN_EMAILS` needs to stay in Vercel after seeding. `ADMIN_SEED_PASSWORD` is only needed when you intentionally create or rotate admin passwords through the script.

## License

This project is created for academic purposes.

"# Carto" 
