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
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

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

Alternatively, use migrations:
```bash
npm run db:migrate
```

## Step 4: Run the Development Server

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

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
- `GET /api/lists` - Get all user lists
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

### Simulating Cart Scanning

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