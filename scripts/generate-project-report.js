const fs = require('fs');
const path = require('path');

const root = process.cwd();
const mdPath = path.join(root, 'PROJECT_REPORT.md');
const pdfPath = path.join(root, 'PROJECT_REPORT.pdf');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function walk(dir, matcher, base = root) {
  const fullDir = path.join(root, dir);
  if (!fs.existsSync(fullDir)) return [];
  return fs.readdirSync(fullDir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(fullDir, entry.name);
    const relative = path.relative(base, fullPath).replaceAll('\\', '/');
    if (entry.isDirectory()) return walk(relative, matcher, base);
    return matcher(relative) ? [relative] : [];
  });
}

function routeFromFile(file) {
  return file
    .replace(/^app/, '')
    .replace(/\/page\.tsx$/, '')
    .replace(/\/route\.ts$/, '')
    .replace(/\[([^\]]+)\]/g, ':$1') || '/';
}

function extractModels() {
  const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
  return Array.from(schema.matchAll(/^model\s+(\w+)\s+\{([\s\S]*?)^}/gm)).map((match) => {
    const name = match[1];
    const body = match[2];
    const fields = body
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('//') && !line.startsWith('@@'))
      .map((line) => line.split(/\s+/).slice(0, 2).join(' '))
      .slice(0, 12);
    const indexes = body
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('@@'));
    return { name, fields, indexes };
  });
}

function dep(name) {
  return dependencies[name] || devDependencies[name] || 'Not found';
}

const pkg = readJson(path.join(root, 'package.json'));
const dependencies = pkg.dependencies || {};
const devDependencies = pkg.devDependencies || {};
const scripts = pkg.scripts || {};
const pages = walk('app', (file) => file.endsWith('/page.tsx')).map(routeFromFile).sort();
const apiRoutes = walk('app/api', (file) => file.endsWith('/route.ts')).map(routeFromFile).sort();
const components = walk('components', (file) => file.endsWith('.tsx')).sort();
const models = extractModels();
const generatedDate = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}).format(new Date());

const techRows = [
  ['Next.js', 'Full-stack framework', 'App Router pages and API routes', 'Routing, SSR/server components, API endpoints', '`package.json`, `app/*`, `app/api/*`'],
  ['React', 'Frontend UI', 'Client components and interactive screens', 'UI rendering and component state', '`package.json`, `components/*`, `app/*/page.tsx`'],
  ['TypeScript', 'Language/tooling', 'Application source and types', 'Static typing', '`tsconfig.json`, `types/index.ts`'],
  ['Tailwind CSS', 'Styling', 'Global CSS and utility classes', 'Responsive UI styling', '`tailwind.config.ts`, `app/globals.css`, component class names'],
  ['Prisma', 'ORM/data access', 'Prisma client and schema', 'PostgreSQL database access', '`prisma/schema.prisma`, `lib/prisma.ts`'],
  ['PostgreSQL', 'Database', 'Prisma datasource provider', 'Relational persistence', '`prisma/schema.prisma` datasource provider'],
  ['NextAuth.js', 'Authentication', 'Credentials auth and session checks', 'JWT sessions and protected data access', '`lib/auth-config.ts`, `app/api/auth/[...nextauth]/route.ts`'],
  ['Zustand', 'Client state', 'Active session store', 'Shared session and receipt state', '`store/session-store.ts`'],
  ['Zod', 'Validation', 'API and form schemas', 'Runtime validation', '`lib/validations.ts`'],
  ['@zxing/browser', 'QR scanning', 'Camera QR scanner', 'Decode cart QR codes from video', '`components/carto/QrScanner.tsx`, `package.json`'],
  ['qrcode / qrcode.react', 'QR generation', 'QR code API and UI support', 'Generate QR payloads/data URLs', '`app/api/cart/qrcode/route.ts`, `package.json`'],
  ['Stripe libraries', 'Payments', 'Dependency and placeholder logic', 'Future payment integration; current flow is mock/demo', '`package.json`, `app/api/payment/create/route.ts`'],
  ['next-pwa', 'PWA/service worker', 'PWA config and generated service worker', 'Installability/offline caching support', '`next.config.js`, `public/manifest.json`, `public/sw.js`'],
  ['bcryptjs', 'Security', 'Password hashing and verification', 'Hash passwords and verify credentials', '`lib/auth.ts`, `app/api/auth/signup/route.ts`'],
  ['date-fns', 'Date formatting', 'List recency display', 'Human-readable date distances', '`app/lists/page.tsx`, `package.json`'],
  ['clsx / tailwind-merge', 'UI utilities', 'Class name composition', 'Conditional Tailwind classes', '`lib/utils.ts`, component files'],
  ['ESLint', 'Code quality', 'Next lint script', 'Static lint checks', '`.eslintrc.json`, `package.json`'],
];

const featureRows = [
  {
    name: 'User authentication',
    does: 'Supports sign up, sign in, JWT sessions, and protected server/API access.',
    user: 'Users create an account or sign in through `/auth/signup` and `/auth/signin`.',
    pages: '`app/auth/signup/page.tsx`, `app/auth/signin/page.tsx`',
    api: '`app/api/auth/signup/route.ts`, `app/api/auth/[...nextauth]/route.ts`',
    models: '`User`',
  },
  {
    name: 'Guest mode',
    does: 'Allows demo use without a full authenticated account by setting guest cookies and storing guest lists.',
    user: 'Users press "Continue as Guest" from auth screens.',
    pages: '`app/auth/signin/page.tsx`, `app/auth/signup/page.tsx`',
    api: '`app/api/auth/guest-bypass/route.ts`, `store/guest-store.ts`',
    models: 'Guest mode uses JSON-backed local storage; database model not used for unauthenticated guest lists.',
  },
  {
    name: 'Dashboard',
    does: 'Shows summary metrics, recent lists, and quick actions for starting shopping.',
    user: 'After login/guest entry, users land on `/dashboard`.',
    pages: '`app/dashboard/page.tsx`, `components/ui/MetricCard.tsx`, `components/ui/ProgressBar.tsx`',
    api: 'Server component queries Prisma directly; no dedicated dashboard API found.',
    models: '`ShoppingList`, `Receipt`, `ReceiptItem`',
  },
  {
    name: 'Shopping list CRUD',
    does: 'Creates, displays, updates, and deletes shopping lists.',
    user: 'Users browse `/lists`, create via `/lists/new`, open `/lists/:id`, and delete lists.',
    pages: '`app/lists/page.tsx`, `app/lists/new/page.tsx`, `app/lists/[id]/page.tsx`, `components/lists/ListCards.tsx`',
    api: '`app/api/lists/route.ts`, `app/api/lists/[id]/route.ts`',
    models: '`ShoppingList`, `ListItem`',
  },
  {
    name: 'Shopping list items',
    does: 'Adds, updates, toggles, and deletes list items with immediate UI feedback.',
    user: 'Users quick-add items, search products, adjust quantities, mark collected, and delete.',
    pages: '`components/lists/ListItemsManager.tsx`, `components/lists/ProductSearch.tsx`',
    api: '`app/api/lists/[id]/items/route.ts`, `app/api/lists/[id]/items/[itemId]/route.ts`',
    models: '`ListItem`, `ShoppingList`, `Product`',
  },
  {
    name: 'Product search',
    does: 'Searches database products or local fallback dataset and returns popular/search results.',
    user: 'Users open product search from the list detail screen.',
    pages: '`components/lists/ProductSearch.tsx`, `lib/product-dataset.ts`',
    api: '`app/api/products/route.ts`',
    models: '`Product`',
  },
  {
    name: 'QR code and cart linking',
    does: 'Scans cart QR payloads, validates cart identifiers/pairing codes, creates dynamic carts if needed, and starts sessions.',
    user: 'Users choose a list, open `/session/start`, scan a cart QR, or enter cart details manually.',
    pages: '`app/session/start/page.tsx`, `components/carto/QrScanner.tsx`',
    api: '`app/api/cart/link/route.ts`, `app/api/cart/qrcode/route.ts`, `app/api/carts/[cartCode]/route.ts`',
    models: '`Cart`, `Store`, `CartSession`, `Receipt`, `Notification`',
  },
  {
    name: 'Active shopping sessions',
    does: 'Displays linked cart state, remaining/collected items, progress, and current receipt total.',
    user: 'Users view `/session` after cart linking or from quick actions.',
    pages: '`app/session/page.tsx`, `store/session-store.ts`',
    api: '`app/api/sessions/active/route.ts`, `app/api/sessions/[id]/route.ts`, `app/api/sessions/[id]/finish/route.ts`',
    models: '`CartSession`, `ShoppingList`, `ListItem`, `Receipt`',
  },
  {
    name: 'Virtual receipt',
    does: 'Shows scanned items, subtotal, tax, total, and receipt status.',
    user: 'Users see the receipt panel during an active session and at checkout.',
    pages: '`components/receipt/VirtualReceipt.tsx`, `components/ui/ReceiptPanel.tsx`',
    api: '`app/api/receipts/[id]/route.ts`, `app/api/receipts/[id]/items/route.ts`, `app/api/receipts/[id]/items/[itemId]/route.ts`',
    models: '`Receipt`, `ReceiptItem`',
  },
  {
    name: 'Receipt item scanning simulation',
    does: 'Adds items to a receipt through an API to simulate cart scanning.',
    user: 'Developer/tester can POST scanned items to the receipt items endpoint.',
    pages: 'No dedicated UI found for manual receipt item simulation.',
    api: '`app/api/receipts/[id]/items/route.ts`',
    models: '`Receipt`, `ReceiptItem`',
  },
  {
    name: 'Checkout and payment',
    does: 'Locks a receipt, displays checkout summary, processes mock payment, updates status and history.',
    user: 'Users finish shopping, review `/checkout`, then confirm payment.',
    pages: '`app/checkout/page.tsx`, `app/checkout/success/page.tsx`',
    api: '`app/api/payment/create/route.ts`, `app/api/sessions/[id]/finish/route.ts`',
    models: '`Receipt`, `CartSession`, `Cart`, `UserStats`, `UserFavoriteProduct`, `Notification`',
  },
  {
    name: 'Order/history pages',
    does: 'Shows paid receipt history.',
    user: 'Users open `/history` from navigation.',
    pages: '`app/history/page.tsx`, `components/layout/BottomNav.tsx`',
    api: 'Server component queries Prisma directly; no dedicated history API found.',
    models: '`Receipt`, `ReceiptItem`, `Store`',
  },
  {
    name: 'Notifications',
    does: 'Lists notifications, counts unread items, and marks selected notifications read.',
    user: 'No complete notification UI found in the inspected pages; API support exists.',
    pages: 'Not found as a full user-facing notifications page.',
    api: '`app/api/notifications/route.ts`',
    models: '`Notification`',
  },
  {
    name: 'Wishlist and favorites',
    does: 'Provides APIs for wishlist items and favorite product tracking.',
    user: 'No complete wishlist/favorites page found in inspected page routes; API support exists.',
    pages: 'Not found as a full user-facing wishlist/favorites page.',
    api: '`app/api/wishlist/route.ts`, `app/api/wishlist/[itemId]/route.ts`, `app/api/users/favorites/route.ts`',
    models: '`Wishlist`, `WishlistItem`, `UserFavoriteProduct`, `Product`',
  },
  {
    name: 'Stores and carts',
    does: 'Represents physical carts, stores, cart status, and dynamic cart lookup/linking.',
    user: 'Cart data is mostly used behind the cart linking flow.',
    pages: '`app/session/start/page.tsx`',
    api: '`app/api/stores/route.ts`, `app/api/carts/[cartCode]/route.ts`, `app/api/cart/link/route.ts`',
    models: '`Store`, `Cart`',
  },
  {
    name: 'PWA/mobile support',
    does: 'Includes manifest, icons, service worker config, and iPhone HTTPS camera guidance.',
    user: 'Users can run mobile testing through HTTPS/tunnel scripts and use phone camera scanning.',
    pages: '`app/layout.tsx`, `SETUP.md`, `README.md`',
    api: 'No API specific to PWA installability.',
    models: 'No database model.',
  },
];

function table(headers, rows) {
  const escape = (value) => String(value).replace(/\n/g, '<br>');
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escape).join(' | ')} |`),
  ].join('\n');
}

function bulletList(items) {
  return items.map((item) => `- ${item}`).join('\n');
}

function codeList(items) {
  return items.map((item) => `- \`${item}\``).join('\n');
}

const allDeps = Object.entries(dependencies).map(([name, version]) => `${name}: ${version}`);
const allDevDeps = Object.entries(devDependencies).map(([name, version]) => `${name}: ${version}`);
const scriptLines = Object.entries(scripts).map(([name, command]) => `\`${name}\`: \`${command}\``);

const report = `# Carto Smart Shopping Cart System — Technical Project Report

## 1. Cover Page

**Project name:** Carto

**Subtitle:** Smart Shopping Cart System

**Short description:** Carto is a smart shopping cart web application that lets users create shopping lists, connect a selected list to a physical cart through QR scanning, monitor an active shopping session, view a virtual receipt, and complete a demo checkout flow.

**Technologies summary:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Prisma, PostgreSQL, NextAuth.js, Zustand, Zod, QR scanning/generation libraries, PWA support, and mock/placeholder payment integration.

**Date generated:** ${generatedDate}

**Author/team:** Not found in the codebase.

**Primary evidence:** \`package.json\`, \`prisma/schema.prisma\`, \`app/\`, \`components/\`, \`lib/\`, \`store/\`, \`README.md\`, and \`SETUP.md\`.

## 2. Executive Summary

Carto is a full-stack smart shopping cart system implemented as a Next.js application. It combines a shopper-facing web interface with backend API routes, authentication, database models, QR/cart linking, active shopping sessions, and receipt/checkout flows.

The project solves a practical retail workflow problem: a shopper can prepare a grocery list before shopping, link that list to a smart cart at the store, track progress as items are collected or scanned, and review a virtual receipt before checkout. The target users are shoppers, developers/evaluators reviewing the system, and potentially store operators if the platform is extended.

The main value of the application is workflow integration: list planning, cart activation, receipt tracking, and checkout are connected in one interface. The app also includes guest mode, making it suitable for demonstrations without full account setup.

Based on the codebase, this appears to be an academic prototype or MVP rather than a production-ready commercial system. Evidence: the project is versioned as \`0.1.0\` and private in \`package.json\`; \`README.md\` states it is created for academic purposes; the payment route uses mock payment behavior with live Stripe code only sketched as comments in \`app/api/payment/create/route.ts\`; guest mode persists data through \`guest_data.json\` via \`store/guest-store.ts\`.

## 3. Project Overview

### Main Idea

Carto models a smart shopping experience. A user creates a shopping list, activates it, links it to a physical cart, follows progress during shopping, and completes checkout from a virtual receipt.

### User Journey

1. The user opens the app and signs in, signs up, or continues as guest.
2. The user opens the dashboard and creates or selects a shopping list.
3. The user adds items manually or through product search.
4. The user activates the list and opens the cart linking page.
5. The user scans a cart QR code or enters cart ID and pairing code manually.
6. The backend creates an active cart session and a draft receipt.
7. The user monitors remaining items, collected items, cart status, and receipt totals.
8. The user finishes shopping, locks the receipt, and opens checkout.
9. The user completes the demo payment and can later view the receipt in history.

### Smart Cart Concept

The smart cart is represented by the \`Cart\` model in \`prisma/schema.prisma\`. It includes a public \`cartCode\`, optional Bluetooth/pairing metadata, a \`storeId\`, status, and last-seen timestamp. Cart linking logic is implemented in \`app/api/cart/link/route.ts\`.

### Shopping List Concept

Shopping lists are represented by \`ShoppingList\` and \`ListItem\` models. The list interface is implemented through \`app/lists/page.tsx\`, \`app/lists/new/page.tsx\`, \`app/lists/[id]/page.tsx\`, and \`components/lists/ListItemsManager.tsx\`.

### QR Cart Linking Concept

The camera scanner is implemented in \`components/carto/QrScanner.tsx\` using \`@zxing/browser\`. The session start page parses and validates cart QR payloads in \`app/session/start/page.tsx\`. The backend endpoint \`app/api/cart/link/route.ts\` validates ownership, cart availability, pairing code, and creates the session/receipt.

### Active Shopping Session Concept

The \`CartSession\` model connects a user, list, cart, and receipt. The active session screen in \`app/session/page.tsx\` polls session APIs and uses \`store/session-store.ts\` for shared client state.

### Virtual Receipt Concept

Receipts are represented by \`Receipt\` and \`ReceiptItem\`. The live receipt panel is implemented in \`components/receipt/VirtualReceipt.tsx\`. Receipt APIs live under \`app/api/receipts/[id]\`.

### Checkout Concept

Checkout starts after a session is finished through \`app/api/sessions/[id]/finish/route.ts\`. The checkout page is \`app/checkout/page.tsx\`; payment processing is handled by \`app/api/payment/create/route.ts\`. The current implementation is mock/demo payment, with Stripe libraries present but live Stripe processing not fully implemented.

## 4. Key Features

${featureRows
  .map(
    (feature) => `### ${feature.name}

**What it does:** ${feature.does}

**How the user interacts with it:** ${feature.user}

**Related pages/components:** ${feature.pages}

**Related API routes:** ${feature.api}

**Related database models:** ${feature.models}`
  )
  .join('\n\n')}

## 5. Technology Stack

${table(['Technology', 'Category', 'Where Used', 'Purpose', 'Evidence'], techRows)}

### Dependency Evidence From \`package.json\`

Runtime dependencies:

${bulletList(allDeps)}

Development dependencies:

${bulletList(allDevDeps)}

## 6. System Architecture

Carto is a modular monolith built with Next.js App Router. The frontend pages, reusable React components, API routes, authentication logic, and database access live in the same project. API routes are serverless-style route handlers under \`app/api\`, while persistent data is accessed through Prisma and PostgreSQL.

The frontend/backend relationship is direct: client components call Next.js API routes with \`fetch\`, and server components query Prisma directly after checking session or guest mode. Authentication is handled through NextAuth.js; protected API routes call \`getServerSession(authOptions)\`.

### Architecture Characteristics

- **Application style:** Full-stack Next.js modular monolith.
- **Frontend:** React components and App Router pages under \`app/\` and \`components/\`.
- **Backend:** Next.js route handlers under \`app/api/\`.
- **Database layer:** Prisma client in \`lib/prisma.ts\`.
- **Authentication:** NextAuth config in \`lib/auth-config.ts\` and provider wrapper in \`app/providers.tsx\`.
- **Client state:** Zustand store in \`store/session-store.ts\`.
- **Validation:** Zod schemas in \`lib/validations.ts\`.
- **Guest storage:** Local JSON-backed store in \`store/guest-store.ts\`.

### Architecture Diagram

\`\`\`mermaid
flowchart TD
  User[User / Mobile Browser] --> UI[Next.js App Router UI]
  UI --> ClientState[Zustand Session Store]
  UI --> Camera[Phone Camera / QR Scanner]
  UI --> API[Next.js API Routes]
  API --> Auth[NextAuth Session Checks]
  API --> Prisma[Prisma Client]
  Prisma --> DB[(PostgreSQL Database)]
  API --> Guest[Guest JSON Store]
  API --> Payment[Mock Payment / Stripe Placeholder]
  API --> PWA[PWA Manifest / Service Worker]
\`\`\`

### Data Flow Example: Cart Linking

1. User selects a list and opens \`/session/start?listId=...\`.
2. \`components/carto/QrScanner.tsx\` captures a QR payload.
3. \`app/session/start/page.tsx\` validates the QR JSON through Zod schemas.
4. The UI posts cart data to \`POST /api/cart/link\`.
5. \`app/api/cart/link/route.ts\` verifies the user session and list ownership.
6. The route creates or updates \`Cart\`, creates \`CartSession\`, creates a draft \`Receipt\`, and creates a \`Notification\`.
7. The user is routed to \`/session?sessionId=...\`.

## 7. Project Structure

Important directories:

- \`app/\`: App Router pages, layouts, API routes, global styles, and providers.
- \`components/\`: Reusable UI, layout, list, cart, and receipt components.
- \`lib/\`: Auth helpers, Prisma client, validations, hooks, utility functions, and product dataset.
- \`store/\`: Zustand active session store and guest data store.
- \`prisma/\`: Database schema, migrations, and seed script.
- \`public/\`: Images, icons, manifest, and generated service worker assets.
- \`types/\`: Shared TypeScript interfaces and NextAuth type augmentation.

### Page Routes Found

${codeList(pages)}

### API Routes Found

${codeList(apiRoutes)}

### Components Found

${codeList(components)}

## 8. Database Design

The database is defined in \`prisma/schema.prisma\` using PostgreSQL as the datasource. The schema includes user accounts, stores, carts, shopping lists, list items, cart sessions, receipts, receipt items, product catalog data, analytics, favorites, wishlists, and notifications.

### Models

${models
  .map(
    (model) => `#### ${model.name}

Fields visible in schema:

${bulletList(model.fields.map((field) => `\`${field}\``))}

Indexes/constraints:

${model.indexes.length ? bulletList(model.indexes.map((index) => `\`${index}\``)) : '- Not found'}`
  )
  .join('\n\n')}

### Database Notes

- The schema uses cascading deletes for important ownership relationships such as users to lists, sessions, receipts, wishlists, and related items.
- Common foreign keys such as \`userId\`, \`listId\`, \`cartId\`, \`receiptId\`, and \`storeId\` are indexed where shown in \`prisma/schema.prisma\`.
- Potential future index improvements are discussed in the limitations/future improvements sections, but no destructive schema change is required for the current report.

## 9. API Design

The API is implemented through Next.js route handlers under \`app/api\`. Most protected APIs call \`getServerSession(authOptions)\` and filter by \`session.user.id\`. Guest-compatible list routes also check \`guest_mode\` and \`guest_session_id\` cookies.

### API Route Inventory

${codeList(apiRoutes)}

### API Categories

- **Authentication:** \`app/api/auth/signup/route.ts\`, \`app/api/auth/[...nextauth]/route.ts\`, \`app/api/auth/guest-bypass/route.ts\`, \`app/api/auth/guest/route.ts\`.
- **Lists and items:** \`app/api/lists/route.ts\`, \`app/api/lists/[id]/route.ts\`, \`app/api/lists/[id]/items/route.ts\`, \`app/api/lists/[id]/items/[itemId]/route.ts\`.
- **Cart and sessions:** \`app/api/cart/link/route.ts\`, \`app/api/cart/qrcode/route.ts\`, \`app/api/carts/[cartCode]/route.ts\`, \`app/api/sessions/*\`.
- **Receipts:** \`app/api/receipts/[id]/route.ts\`, \`app/api/receipts/[id]/items/route.ts\`, \`app/api/receipts/[id]/items/[itemId]/route.ts\`.
- **Checkout/payment:** \`app/api/payment/create/route.ts\`.
- **Product catalog:** \`app/api/products/route.ts\`.
- **Store/cart metadata:** \`app/api/stores/route.ts\`.
- **User extensions:** \`app/api/users/stats/route.ts\`, \`app/api/users/favorites/route.ts\`, \`app/api/wishlist/route.ts\`, \`app/api/notifications/route.ts\`.

## 10. UI/UX Design

The UI is mobile-first and uses Tailwind CSS. Common visual components include \`Button\`, \`Badge\`, \`Card\`, \`EmptyState\`, \`LoadingState\`, \`MetricCard\`, \`ProgressBar\`, and \`ReceiptPanel\`.

### UX Patterns Found

- Sticky mobile bottom navigation in \`components/layout/BottomNav.tsx\`.
- Page shells through \`components/layout/PageContainer.tsx\` and \`components/layout/Header.tsx\`.
- Loading states through \`components/ui/LoadingState.tsx\`.
- Optimistic list item updates and pending states in \`components/lists/ListItemsManager.tsx\`.
- Debounced product search with stale request cancellation in \`components/lists/ProductSearch.tsx\`.
- Camera permission and HTTPS messaging in \`components/carto/QrScanner.tsx\`.
- Receipt display formatted as a checkout panel in \`components/receipt/VirtualReceipt.tsx\`.

### Responsive/Mobile Behavior

The project includes PWA metadata in \`app/layout.tsx\`, icons and manifest files under \`public/\`, and next-pwa configuration in \`next.config.js\`. Phone camera access requires HTTPS, and this is documented in \`SETUP.md\` and supported by \`dev:https\` and \`tunnel\` scripts in \`package.json\`.

## 11. Authentication and Authorization

Authentication uses NextAuth.js credentials provider in \`lib/auth-config.ts\`. Password hashing/verification is implemented using bcrypt helpers in \`lib/auth.ts\`. The signup route creates users in \`app/api/auth/signup/route.ts\`.

Session behavior:

- NextAuth uses JWT session strategy in \`lib/auth-config.ts\`.
- The root provider wraps the app through \`app/providers.tsx\`.
- Protected server pages check sessions or guest mode before rendering.
- Middleware in \`middleware.ts\` protects dashboard, lists, session, checkout, and profile routes unless guest mode is active.

Authorization pattern:

- API routes verify the session.
- User-owned records are filtered by \`session.user.id\`.
- Guest mode uses \`guest_mode\` and \`guest_session_id\` cookies.

## 12. PWA and Mobile Support

The project uses \`next-pwa\` in \`next.config.js\`, includes \`public/manifest.json\`, and has app icons under \`public/icons/\`. The PWA config caches product API responses, images, fonts, and navigations.

Mobile camera support is present through \`components/carto/QrScanner.tsx\`. The code checks \`window.isSecureContext\` before starting camera access, because iOS and other phone browsers require HTTPS for camera APIs. The setup guide includes tunnel and local HTTPS options.

## 13. Setup and Running Instructions

Evidence for commands is in \`package.json\` and \`SETUP.md\`.

### Prerequisites

- Node.js 18+ is required according to \`SETUP.md\`.
- PostgreSQL database is required for full database-backed behavior.
- npm is used in the project scripts.

### Environment Variables

Expected environment variables:

- \`DATABASE_URL\`: PostgreSQL connection string.
- \`NEXTAUTH_URL\`: recommended for stable NextAuth behavior, especially tunnels/deployment.
- \`NEXTAUTH_SECRET\`: required for secure NextAuth sessions.
- \`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY\`: optional/placeholder for payment integration.
- \`STRIPE_SECRET_KEY\`: optional/placeholder for payment integration.

### Main Commands

${bulletList(scriptLines)}

### Typical Setup Flow

1. Run \`npm install\`.
2. Create/configure \`.env\`.
3. Run \`npm run db:generate\`.
4. Run \`npm run db:push\` or \`npm run db:migrate\`.
5. Run \`npm run dev\`.
6. Open \`http://localhost:3000\`.

### iPhone Camera Testing

Phone camera access requires HTTPS. The project includes:

- \`npm run dev:https\`: Next.js development server with experimental HTTPS.
- \`npm run tunnel\`: localtunnel HTTPS tunnel for phone testing.
- \`npm run dev:host\`: host dev server on \`0.0.0.0\` for local network testing, though HTTP alone is not enough for phone camera access.

## 14. Testing and Validation

Available validation commands:

- \`npm run lint\`: Next.js linting.
- \`npm run build\`: production build and TypeScript checking.
- \`npm run db:generate\`: Prisma client generation.
- \`npm run db:studio\`: Prisma Studio for database inspection.

Manual testing paths:

- Sign up/sign in/guest mode.
- Create shopping list.
- Add item manually and through product search.
- Toggle collected status and update quantities.
- Activate a list.
- Scan or manually enter cart details.
- View active session.
- Finish shopping.
- Complete checkout.
- View history.
- Simulate receipt scanning through \`POST /api/receipts/:id/items\`.

Automated test suite:

- Not found in the codebase. No dedicated Jest, Vitest, Playwright, or Cypress test configuration was found in \`package.json\`.

## 15. Limitations and Risks

- **Payment is not production complete.** \`app/api/payment/create/route.ts\` uses a mock payment ID and contains comments for future Stripe integration.
- **Real-time updates are polling-based.** Active session and receipt behavior use polling rather than WebSockets or server-sent events.
- **Guest mode persists to local JSON.** \`store/guest-store.ts\` writes to \`guest_data.json\`, which is appropriate for demos but not production multi-user storage.
- **No automated test suite found.** Lint/build exist, but no formal unit/e2e tests were found.
- **No complete notifications UI found.** Notification APIs and database model exist, but a full notification screen was not found.
- **No complete wishlist/favorites UI found.** APIs and models exist, but full user-facing pages were not found.
- **Camera requires HTTPS on phones.** This is handled/documented, but it affects local network demos.
- **Physical smart cart hardware integration is unclear.** Cart data models and QR linking exist, but actual hardware communication beyond QR/Bluetooth metadata is unclear from the codebase.
- **Production deployment hardening is incomplete.** Environment management, secrets, payment provider configuration, and operational monitoring would need review.

## 16. Future Improvements

- Replace polling with WebSockets or server-sent events for active sessions and receipts.
- Complete production Stripe payment integration.
- Add automated tests for API routes, list interactions, cart linking, checkout, and guest mode.
- Add a complete notification center UI.
- Add wishlist/favorites pages if those APIs are intended for end users.
- Add store inventory, aisle locations, and cart navigation.
- Add admin/store operator screens for carts, stores, and inventory.
- Add stronger product search indexes or PostgreSQL full-text/trigram search if catalog size grows.
- Review and add compound database indexes after measuring production query plans.
- Add observability: API timing logs in development, structured production logs, error reporting, and performance monitoring.
- Improve PWA install flow and offline behavior for non-critical pages.

## 17. Evidence Summary

Key files inspected:

- \`package.json\`: dependencies, scripts, project version.
- \`prisma/schema.prisma\`: database models and relations.
- \`app/dashboard/page.tsx\`: dashboard behavior and stats.
- \`app/lists/page.tsx\`, \`app/lists/new/page.tsx\`, \`app/lists/[id]/page.tsx\`: list workflows.
- \`components/lists/ListItemsManager.tsx\`: list item interaction behavior.
- \`components/lists/ProductSearch.tsx\`: product search UI.
- \`components/carto/QrScanner.tsx\`: camera QR scanning.
- \`app/session/start/page.tsx\`: cart QR parsing and linking UI.
- \`app/session/page.tsx\`: active session UI and polling.
- \`components/receipt/VirtualReceipt.tsx\`: receipt display.
- \`app/checkout/page.tsx\`, \`app/checkout/success/page.tsx\`: checkout screens.
- \`app/api/*\`: backend API route handlers.
- \`lib/auth-config.ts\`, \`lib/auth.ts\`: authentication.
- \`lib/validations.ts\`: Zod schemas.
- \`store/session-store.ts\`, \`store/guest-store.ts\`: client/shared state and guest persistence.
- \`next.config.js\`, \`public/manifest.json\`: PWA configuration.
- \`SETUP.md\`, \`README.md\`: setup and project notes.

## 18. Conclusion

Carto is a substantial full-stack prototype/MVP for a smart shopping cart experience. It demonstrates list planning, QR-based cart linking, active session tracking, virtual receipts, checkout, authentication, guest mode, and a reasonably complete data model. The project is suitable for academic evaluation and further product development. The largest gaps before production would be real hardware integration, production payment processing, automated tests, stronger observability, real-time transport, and deployment hardening.
`;

fs.writeFileSync(mdPath, report, 'utf8');

const pageWidth = 612;
const pageHeight = 792;
const marginX = 48;
const marginTop = 54;
const marginBottom = 46;
const contentWidth = pageWidth - marginX * 2;

function sanitize(text) {
  return String(text)
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, (char) => {
      if (char === '—') return '-';
      if (char === '’' || char === '‘') return "'";
      if (char === '“' || char === '”') return '"';
      if (char === '•') return '-';
      return '';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePdfText(text) {
  return sanitize(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function styleFor(line) {
  if (line.startsWith('# ')) return { type: 'title', size: 22, indent: 0, text: line.replace(/^# /, '') };
  if (line.startsWith('## ')) return { type: 'h1', size: 15, indent: 0, text: line.replace(/^## /, '') };
  if (line.startsWith('### ')) return { type: 'h2', size: 12.5, indent: 0, text: line.replace(/^### /, '') };
  if (line.startsWith('#### ')) return { type: 'h3', size: 11.5, indent: 0, text: line.replace(/^#### /, '') };
  if (line.startsWith('- ')) return { type: 'bullet', size: 9.5, indent: 14, text: line };
  if (/^\d+\.\s/.test(line)) return { type: 'bullet', size: 9.5, indent: 14, text: line };
  if (line.startsWith('| ')) return { type: 'table', size: 7.4, indent: 0, text: line };
  if (line.startsWith('```')) return { type: 'code', size: 8.5, indent: 10, text: line };
  return { type: 'p', size: 9.8, indent: 0, text: line };
}

function lineHeight(type) {
  if (type === 'title') return 29;
  if (type === 'h1') return 22;
  if (type === 'h2') return 18;
  if (type === 'h3') return 16;
  if (type === 'table') return 11;
  if (type === 'code') return 12;
  return 13.5;
}

function color(type) {
  if (type === 'title' || type === 'h1') return '0.02 0.38 0.26 rg';
  if (type === 'h2' || type === 'h3') return '0.10 0.22 0.32 rg';
  if (type === 'table' || type === 'code') return '0.16 0.18 0.22 rg';
  return '0.07 0.09 0.13 rg';
}

function stripMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/<br>/g, ' / ');
}

function wrap(text, size, width) {
  const clean = sanitize(stripMarkdown(text));
  if (!clean) return [];
  const maxChars = Math.max(20, Math.floor(width / (size * 0.5)));
  if (clean.startsWith('| ')) {
    const chunks = [];
    for (let i = 0; i < clean.length; i += maxChars) chunks.push(clean.slice(i, i + maxChars));
    return chunks;
  }
  const words = clean.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if (!current) current = word;
    else if ((current + ' ' + word).length <= maxChars) current += ' ' + word;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

const pagesOut = [[]];
let y = pageHeight - marginTop;

function newPage() {
  pagesOut.push([]);
  y = pageHeight - marginTop;
}

function addPdfLine(text, type, size, indent) {
  const lh = lineHeight(type);
  if (y - lh < marginBottom) newPage();
  pagesOut[pagesOut.length - 1].push({ text, type, size, x: marginX + indent, y });
  y -= lh;
}

for (const rawLine of report.split(/\r?\n/)) {
  const line = rawLine.trimEnd();
  if (!line.trim()) {
    y -= 7;
    continue;
  }
  const styled = styleFor(line.trim());
  if (['h1', 'h2', 'h3'].includes(styled.type)) y -= 5;
  const width = contentWidth - styled.indent;
  const wrapped = wrap(styled.text, styled.size, width);
  for (const wrappedLine of wrapped) addPdfLine(wrappedLine, styled.type, styled.size, styled.indent);
  if (styled.type === 'title' || styled.type === 'h1') y -= 6;
}

function pageStream(lines, pageIndex, totalPages) {
  const commands = [];
  for (const line of lines) {
    commands.push(
      'BT',
      '/F1 ' + line.size.toFixed(2) + ' Tf',
      color(line.type),
      '1 0 0 1 ' + line.x.toFixed(2) + ' ' + line.y.toFixed(2) + ' Tm',
      '(' + escapePdfText(line.text) + ') Tj',
      'ET'
    );
  }
  commands.push(
    'BT',
    '/F1 8 Tf',
    '0.45 0.49 0.56 rg',
    '1 0 0 1 48 28 Tm',
    '(Carto Technical Project Report - Page ' + (pageIndex + 1) + ' of ' + totalPages + ') Tj',
    'ET'
  );
  return commands.join('\n');
}

function buildPdf() {
  const objects = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  const pageObjectIds = pagesOut.map((_, index) => 4 + index * 2);
  objects.push('<< /Type /Pages /Kids [' + pageObjectIds.map((id) => id + ' 0 R').join(' ') + '] /Count ' + pagesOut.length + ' >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  pagesOut.forEach((page, index) => {
    const pageId = 4 + index * 2;
    const contentId = pageId + 1;
    objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageWidth + ' ' + pageHeight + '] /Resources << /Font << /F1 3 0 R >> >> /Contents ' + contentId + ' 0 R >>');
    const stream = pageStream(page, index, pagesOut.length);
    objects.push('<< /Length ' + Buffer.byteLength(stream, 'utf8') + ' >>\nstream\n' + stream + '\nendstream');
  });
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += index + 1 + ' 0 obj\n' + object + '\nendobj\n';
  });
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += String(offset).padStart(10, '0') + ' 00000 n \n';
  });
  pdf += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF\n';
  return pdf;
}

fs.writeFileSync(pdfPath, buildPdf(), 'binary');
console.log(mdPath);
console.log(pdfPath);
