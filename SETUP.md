# Carto Setup Guide

This guide will help you set up and run the Carto smart shopping cart application.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database (local or cloud)
- npm or yarn package manager

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Environment Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/carto?schema=public"

# NextAuth
AUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Admin allowlist
ADMIN_EMAILS="admin@example.com"

# Firebase client SDK (browser phone OTP)
NEXT_PUBLIC_FIREBASE_API_KEY="your-firebase-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-firebase-project-id"
NEXT_PUBLIC_FIREBASE_APP_ID="your-firebase-app-id"

# Firebase Admin SDK (server ID-token verification)
FIREBASE_PROJECT_ID="your-firebase-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Optional: Stripe (for payment integration)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
```

### Generating NextAuth Secret

You can generate a secure secret using:

```bash
openssl rand -base64 32
```

## Step 3: Database Setup

1. Create a PostgreSQL database named `carto` (or your preferred name)

2. Generate Prisma client:
```bash
npm run db:generate
```

3. Push the schema to your database:
```bash
npm run db:push
```

Set either `AUTH_SECRET` or `NEXTAUTH_SECRET`; `AUTH_SECRET` is preferred. Only `NEXT_PUBLIC_*` variables belong in client-side bundles.

Alternatively, use migrations:
```bash
npm run db:migrate
```

For production-like environments, prefer migrations so the `GuestSession` table and guest ownership columns are applied consistently. `db:push` is fine for disposable demo databases.

## Step 4: Run the Development Server

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

### Testing the Camera on an iPhone

Phone browsers require a secure context before they allow camera access. If you open Carto from your computer's local network address, such as `http://192.168.1.20:3000`, iOS will block the camera.

Use one of these mobile testing options:

#### Option A: Secure tunnel (recommended)

In one terminal, start Carto:

```bash
npm run dev
```

In another terminal, start a temporary HTTPS tunnel:

```bash
npm run tunnel
```

Open the `https://...loca.lt` URL on the iPhone. If you set `NEXTAUTH_URL` in `.env`, update it to the tunnel URL and restart `npm run dev`.

#### Option B: Local HTTPS on your network

Start the dev server with HTTPS enabled:

```bash
npm run dev:https
```

Open the shown `https://<your-computer-ip>:3000` URL on the iPhone. Because this uses a local development certificate, iOS may require you to open the URL in Safari, accept the certificate warning, and trust the certificate in Settings before camera access works.

#### Option C: Desktop-only local testing

Camera access is allowed from `http://localhost:3000` on the same computer running the dev server. This does not help an iPhone, because `localhost` on the iPhone means the phone itself, not your computer.

## Step 5: Create Your First Account

1. Navigate to [http://localhost:3000/auth/signup](http://localhost:3000/auth/signup)
2. Create an account with your email and password
3. You'll be redirected to the dashboard

## Project Structure

```
/app
  /auth          # Authentication pages (sign in, sign up)
  /dashboard     # Main dashboard after login
  /lists         # Shopping list management
  /session       # Active shopping session tracking
  /checkout      # Checkout and payment flow
/api
  /auth          # NextAuth API routes
  /lists         # Shopping list CRUD operations
  /sessions      # Session management
  /cart          # Cart linking and QR code generation
  /receipts      # Virtual receipt management
  /payment       # Payment processing
/prisma          # Database schema and migrations
/components      # Reusable React components
/lib             # Utilities and helpers
/types           # TypeScript type definitions
/store           # Zustand state management
```

## Key Features

### 1. User Authentication
- Sign up with email and password
- Continue as guest with a database-backed `guest_session_id` cookie
- Secure session management with NextAuth
- Protected routes with middleware

### 2. Shopping List Management
- Create, edit, and delete shopping lists
- Add items with quantity and category
- Mark items as collected
- Track list progress

### 3. Cart Linking
- Generate QR codes for cart linking
- Manual cart ID entry option
- Secure cart-to-list association

### 4. Real-Time Session Tracking
- Live shopping progress updates
- Cart connection status
- Automatic receipt creation

### 5. Virtual Receipt
- Real-time item updates
- Add/remove items before checkout
- Dynamic price calculation
- Receipt locking for checkout

### 6. Checkout & Payment
- Review receipt before payment
- Payment processing (mock or Stripe)
- Order completion confirmation

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/[...nextauth]` - NextAuth endpoints

### Shopping Lists
- `GET /api/lists` - Get all lists for the current user or guest session
- `POST /api/lists` - Create new list
- `GET /api/lists/[id]` - Get specific list
- `PUT /api/lists/[id]` - Update list
- `DELETE /api/lists/[id]` - Delete list
- `GET /api/lists/[id]/items` - Get list items
- `POST /api/lists/[id]/items` - Add item to list
- `PUT /api/lists/[id]/items/[itemId]` - Update item
- `DELETE /api/lists/[id]/items/[itemId]` - Delete item

### Cart & Sessions
- `POST /api/cart/link` - Link cart to list
- `GET /api/cart/qrcode?listId=xxx` - Generate QR code
- `GET /api/carts/[cartCode]/active-session` - Device-only active session endpoint, requires `Authorization: Bearer <deviceSecret>`
- `GET /api/sessions` - Get all sessions
- `GET /api/sessions/active` - Get active session
- `GET /api/sessions/[id]` - Get specific session
- `POST /api/sessions/[id]/finish` - Finish shopping session

### Receipts
- `GET /api/receipts/[id]` - Get receipt
- `POST /api/receipts/[id]/items` - Add item to receipt (simulates scanning)
- `PUT /api/receipts/[id]/items/[itemId]` - Update receipt item
- `DELETE /api/receipts/[id]/items/[itemId]` - Remove receipt item

### Payment
- `POST /api/payment/create` - Create payment session

## Testing the Application

### Manual Guest Mode Checklist

1. Clear browser cookies.
2. Visit `/dashboard`; you should be redirected to `/auth/signin`.
3. Click **Continue as Guest**.
4. Confirm the HTTP-only `guest_session_id` cookie is set.
5. Create a shopping list and add items.
6. Refresh the page; the data should persist.
7. Restart the dev server; the data should still persist from PostgreSQL.
8. Sign in as a real user; guest lists should not appear.
9. Verify no `guest_data.json` file is created or used.

### Simulating Cart Scanning

For the QR/device flow, create or seed a physical cart with:

```text
cartCode: CART-001
pairingCode: 123456
deviceSecret: dev-device-secret
status: AVAILABLE
```

The seed script creates this demo cart when run. The cart QR payload should contain only pairing data:

```json
{
  "type": "cart_pairing",
  "cartCode": "CART-001",
  "pairingCode": "123456"
}
```

Open `/device/CART-001`, enter `dev-device-secret`, then link a selected list from `/session/start?listId=<listId>`. The device page polls the protected backend endpoint and shows the assigned list after linking.

To simulate items being scanned by the cart, you can use the receipt items API:

```bash
curl -X POST http://localhost:3000/api/receipts/[receiptId]/items \
  -H "Content-Type: application/json" \
  -H "Cookie: [your-session-cookie]" \
  -d '{
    "name": "Milk",
    "price": 3.99,
    "quantity": 1,
    "category": "Dairy"
  }'
```

## Database Management

### View Database with Prisma Studio

```bash
npm run db:studio
```

This opens a visual database browser at [http://localhost:5555](http://localhost:5555)

### Reset Database

To reset the database (WARNING: This deletes all data):

```bash
npx prisma migrate reset
```

## Production Deployment

1. Set up environment variables in your hosting platform
2. Run database migrations
3. Build the application:
```bash
npm run build
```
4. Start the production server:
```bash
npm start
```

## Troubleshooting

### Database Connection Issues
- Verify your `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- Check database credentials

### NextAuth Issues
- Ensure `NEXTAUTH_SECRET` is set
- Verify `NEXTAUTH_URL` matches your deployment URL
- Ensure Google OAuth redirect URI includes `/api/auth/callback/google`
- For phone OTP, enable Phone provider in Firebase Authentication and add your app domain to Firebase authorized domains
- Keep `FIREBASE_PRIVATE_KEY` server-side only and preserve escaped `\n` line breaks in `.env`

### TypeScript Errors
- Run `npm run db:generate` after schema changes
- Restart the development server

## Academic Notes

This project demonstrates:
- Full-stack Next.js development with App Router
- TypeScript type safety
- Database design with Prisma ORM
- Authentication and authorization
- Real-time data updates
- RESTful API design
- Component-based architecture
- State management with Zustand

## Future Enhancements

- WebSocket support for true real-time updates
- Mobile app integration
- Advanced analytics and reporting
- Multi-store support
- Social features (shared lists)
- AI-powered shopping suggestions
