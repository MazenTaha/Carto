# CartoMAIN - Smart Shopping Cart System

A comprehensive Next.js application for managing smart shopping carts with real-time tracking, virtual receipts, and secure checkout.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Payment**: Stripe (sandbox)

## Features

- User authentication (email/password)
- Shopping list management (CRUD)
- QR code cart linking
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
- NextAuth secret
- Stripe keys (optional for sandbox)

4. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Project Structure

```
/app
  /auth          # Authentication pages
  /dashboard     # Main dashboard
  /lists         # Shopping list management
  /session       # Active shopping session
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
- **ShoppingList**: User shopping lists
- **ListItem**: Items in shopping lists
- **CartSession**: Active shopping sessions
- **Receipt**: Virtual receipts
- **ReceiptItem**: Items in receipts

## License

This project is created for academic purposes.

"# Carto" 
