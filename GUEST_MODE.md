# Guest Mode - No Database Required

## Overview

Carto now supports **Guest Mode** which allows you to explore the application **without setting up a database**. This is perfect for:

- Quick demos and presentations
- Testing the UI and user experience
- Development when database setup is not ready
- Academic presentations

## How to Use Guest Mode

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Navigate to the sign-in page:**
   - Go to `http://localhost:3000/auth/signin`

3. **Click "Skip & Continue as Guest":**
   - This button is available on both sign-in and sign-up pages
   - No database or configuration required!

4. **Explore the application:**
   - You'll be redirected to the dashboard
   - You can navigate through all pages
   - UI components and layouts are fully functional

## What Works in Guest Mode

✅ **Fully Functional:**
- All UI pages and navigation
- Dashboard layout
- Shopping list pages (UI only)
- Session pages (UI only)
- Checkout pages (UI only)
- All React components and styling

❌ **Limited (Requires Database):**
- Creating/editing shopping lists (data won't persist)
- Saving user data
- Real shopping sessions
- Payment processing
- Data persistence

## Technical Details

### How It Works

1. **Cookie-Based Authentication:**
   - Guest mode sets a `guest_mode` cookie
   - Middleware checks this cookie before requiring authentication
   - No database queries are made

2. **Lazy Loading:**
   - Prisma Client only loads when actually needed
   - NextAuth only initializes if configured
   - Database code is completely skipped in guest mode

3. **Graceful Degradation:**
   - All pages handle missing database gracefully
   - Error messages are user-friendly
   - No crashes or server errors

### Files Modified for Guest Mode

- `middleware.ts` - Checks guest mode cookie first
- `app/dashboard/page.tsx` - Lazy loads database code
- `lib/prisma.ts` - Only initializes if DATABASE_URL is set
- `lib/auth-config.ts` - Lazy loads Prisma
- `app/api/auth/guest-bypass/route.ts` - Simple cookie-based bypass

## Setting Up Database (Optional)

If you want full functionality later, you can set up the database:

1. **Install PostgreSQL** (or use a cloud service)

2. **Create `.env` file:**
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/carto"
   NEXTAUTH_SECRET="your-secret-here"
   NEXTAUTH_URL="http://localhost:3000"
   ```

3. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

4. **Push schema to database:**
   ```bash
   npx prisma db push
   ```

5. **Restart the server:**
   ```bash
   npm run dev
   ```

After setup, you can create real accounts and use all features!

## Troubleshooting

### "Skip button doesn't work"
- Make sure the dev server is running
- Check browser console for errors
- Try clearing cookies and trying again

### "Server error after skipping"
- Make sure you've accepted all the code changes
- Restart the dev server: `npm run dev`
- Check terminal for specific error messages

### "Some pages show errors"
- This is normal in guest mode for pages that require database
- The UI should still be visible
- Full functionality requires database setup

## Notes

- Guest mode is intended for **development and demos only**
- For production, always set up proper authentication and database
- Data created in guest mode is not persisted
- The "Guest Mode" badge appears in the navbar when active

