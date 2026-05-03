const fs = require('fs');
const path = require('path');

const root = process.cwd();
const outputDir = path.join(root, 'docs');
const outputPath = path.join(outputDir, 'Carto_Project_Overview.pdf');

function walk(dir, matcher, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath, matcher, base);
    if (!matcher(fullPath)) return [];
    return [path.relative(base, fullPath).replaceAll('\\', '/')];
  });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function extractPrismaModels() {
  const schemaPath = path.join(root, 'prisma', 'schema.prisma');
  if (!fs.existsSync(schemaPath)) return [];
  const schema = fs.readFileSync(schemaPath, 'utf8');
  return Array.from(schema.matchAll(/^model\s+(\w+)\s+\{/gm)).map((match) => match[1]);
}

function routeLabel(relativePath) {
  return relativePath
    .replace(/\/page\.tsx$/, '')
    .replace(/\/route\.ts$/, '')
    .replace(/^app/, '')
    .replace(/\[([^\]]+)\]/g, ':$1') || '/';
}

const packageJson = readJson(path.join(root, 'package.json'));
const appPages = walk(path.join(root, 'app'), (file) => file.endsWith('page.tsx'), root)
  .map(routeLabel)
  .sort();
const apiRoutes = walk(path.join(root, 'app', 'api'), (file) => file.endsWith('route.ts'), root)
  .map(routeLabel)
  .sort();
const components = walk(path.join(root, 'components'), (file) => file.endsWith('.tsx'), root).sort();
const prismaModels = extractPrismaModels();

const dependencies = Object.entries(packageJson.dependencies || {})
  .map(([name, version]) => `${name} ${version}`);
const scripts = Object.entries(packageJson.scripts || {})
  .map(([name, command]) => `${name}: ${command}`);

const blocks = [
  { type: 'title', text: 'Carto Smart Shopping Cart System' },
  { type: 'subtitle', text: 'Complete Project Overview, Features, Architecture, Technologies, and Setup' },
  { type: 'small', text: `Generated from local project: ${root}` },
  { type: 'gap' },

  { type: 'h1', text: '1. Executive Summary' },
  { type: 'p', text: 'Carto is a full-stack smart shopping cart web application built with Next.js App Router. It lets a shopper create reusable grocery lists, link a selected list to a physical cart by QR code, track an active shopping session, view a live virtual receipt, and complete a demo checkout flow.' },
  { type: 'p', text: 'The project supports authenticated users and guest mode. It includes database-backed shopping lists, cart sessions, receipts, notifications, product search, checkout history, profile/dashboard screens, and PWA/mobile-ready behavior.' },

  { type: 'h1', text: '2. Technology Stack' },
  { type: 'bullet', text: 'Framework: Next.js 14 App Router with React 18.' },
  { type: 'bullet', text: 'Language: TypeScript.' },
  { type: 'bullet', text: 'Database: PostgreSQL accessed through Prisma ORM.' },
  { type: 'bullet', text: 'Authentication: NextAuth.js credentials provider with JWT sessions.' },
  { type: 'bullet', text: 'State management: Zustand for active session state.' },
  { type: 'bullet', text: 'Styling: Tailwind CSS with reusable UI components.' },
  { type: 'bullet', text: 'QR and camera: @zxing/browser for scanning and qrcode/qrcode.react for QR generation.' },
  { type: 'bullet', text: 'Payments: Mock checkout flow with Stripe dependency ready for integration.' },
  { type: 'bullet', text: 'PWA: next-pwa service worker and manifest configuration.' },
  { type: 'bullet', text: 'Validation: Zod schemas for user input and API payloads.' },

  { type: 'h1', text: '3. Core User Features' },
  { type: 'bullet', text: 'Sign up and sign in with email/password.' },
  { type: 'bullet', text: 'Continue as guest using local guest session data.' },
  { type: 'bullet', text: 'Dashboard with quick actions, metrics, recent lists, and shopping entry points.' },
  { type: 'bullet', text: 'Create, view, edit, and delete shopping lists.' },
  { type: 'bullet', text: 'Add list items manually or from product search.' },
  { type: 'bullet', text: 'Change item quantities, mark items collected, and delete items.' },
  { type: 'bullet', text: 'Activate a shopping list and link it to a cart by scanning a QR code.' },
  { type: 'bullet', text: 'Manual cart ID and pairing code entry for fallback cart linking.' },
  { type: 'bullet', text: 'Active session screen showing cart status, progress, remaining items, collected items, and estimated total.' },
  { type: 'bullet', text: 'Virtual receipt that shows scanned items, subtotal, tax, and total.' },
  { type: 'bullet', text: 'Finish shopping, lock receipt, review checkout, and complete payment.' },
  { type: 'bullet', text: 'Checkout success and paid receipt history.' },
  { type: 'bullet', text: 'Profile and user-facing navigation on mobile and desktop.' },
  { type: 'bullet', text: 'Notifications and user stats API support.' },
  { type: 'bullet', text: 'Wishlist and favorite product API support.' },

  { type: 'h1', text: '4. Important UX and Performance Behavior' },
  { type: 'bullet', text: 'List item actions use immediate feedback and optimistic UI updates.' },
  { type: 'bullet', text: 'Buttons prevent duplicate submissions during async actions.' },
  { type: 'bullet', text: 'Product search is debounced and aborts stale requests.' },
  { type: 'bullet', text: 'Session and receipt polling avoid overlapping requests.' },
  { type: 'bullet', text: 'API responses are trimmed with Prisma select where practical.' },
  { type: 'bullet', text: 'Authenticated API routes are marked dynamic to avoid static-generation noise.' },
  { type: 'bullet', text: 'Camera scanning warns users when HTTPS is required on phones.' },

  { type: 'h1', text: '5. Application Architecture' },
  { type: 'p', text: 'The app uses Next.js App Router. Page routes live under app, reusable visual elements live in components, server API endpoints live under app/api, Prisma schema and migrations live under prisma, shared helpers live in lib, Zustand stores live in store, and shared TypeScript interfaces live in types.' },
  { type: 'bullet', text: 'Server components are used for page-level data loading where appropriate.' },
  { type: 'bullet', text: 'Client components handle forms, camera access, optimistic UI, polling, and interactive controls.' },
  { type: 'bullet', text: 'API routes enforce ownership through session checks and userId filtering.' },
  { type: 'bullet', text: 'Prisma maps application models to PostgreSQL tables.' },
  { type: 'bullet', text: 'Guest mode uses a local JSON-backed guest store for development/demo use.' },

  { type: 'h1', text: '6. Page Routes' },
  ...appPages.map((route) => ({ type: 'bullet', text: route })),

  { type: 'h1', text: '7. API Routes' },
  ...apiRoutes.map((route) => ({ type: 'bullet', text: route })),

  { type: 'h1', text: '8. Prisma Data Model' },
  { type: 'p', text: 'The database schema covers users, stores, physical carts, shopping lists, list items, cart sessions, receipts, receipt items, products, user stats, favorite products, wishlists, and notifications.' },
  ...prismaModels.map((model) => ({ type: 'bullet', text: model })),

  { type: 'h1', text: '9. Shopping List Flow' },
  { type: 'p', text: 'Users create named lists, add products, update quantities, mark items collected, and activate a list when they are ready to connect to a smart cart. The list detail screen is optimized for repeated small actions and immediate feedback.' },
  { type: 'bullet', text: 'Create list: POST /api/lists.' },
  { type: 'bullet', text: 'Fetch list detail: app/lists/:id with list ownership checks.' },
  { type: 'bullet', text: 'Add item: POST /api/lists/:id/items.' },
  { type: 'bullet', text: 'Update item: PUT /api/lists/:id/items/:itemId.' },
  { type: 'bullet', text: 'Delete item: DELETE /api/lists/:id/items/:itemId.' },

  { type: 'h1', text: '10. Cart Linking and QR Flow' },
  { type: 'p', text: 'A shopper selects a list, opens the connect-to-cart screen, scans a Carto QR code, validates the JSON payload, and posts cart data to /api/cart/link. The backend verifies list ownership, validates cart availability and pairing code, creates or reuses the physical cart, closes previous active sessions for the user, creates a new cart session and draft receipt, and creates a notification.' },
  { type: 'bullet', text: 'Camera scanning uses browser media APIs and requires HTTPS on phones.' },
  { type: 'bullet', text: 'Manual cart ID and pairing code are available when scanning is unavailable.' },
  { type: 'bullet', text: 'The API hides sensitive pairing code data before responding.' },

  { type: 'h1', text: '11. Active Session and Receipt Flow' },
  { type: 'p', text: 'The active session page polls the session endpoint for cart/list/receipt changes and uses Zustand to hold the current session state. The receipt panel displays scanned items, subtotal, estimated tax, and total.' },
  { type: 'bullet', text: 'GET /api/sessions/active finds the newest active or disconnected session for the user.' },
  { type: 'bullet', text: 'GET /api/sessions/:id fetches one session with selected shopping list and receipt fields.' },
  { type: 'bullet', text: 'POST /api/sessions/:id/finish completes the cart session and locks or creates a receipt.' },

  { type: 'h1', text: '12. Checkout and Payment Flow' },
  { type: 'p', text: 'Checkout loads the locked receipt, lets the user select a demo payment method, and posts to /api/payment/create. The payment route marks payment processing, completes the mock payment, marks the receipt paid, checks out the session, releases the cart, updates user stats, tracks favorites, creates a notification, and returns a payment result.' },
  { type: 'bullet', text: 'Mock payment ID format: pi_mock_<timestamp>.' },
  { type: 'bullet', text: 'Stripe live integration placeholder is present for production expansion.' },

  { type: 'h1', text: '13. Security and Data Ownership' },
  { type: 'bullet', text: 'Protected screens redirect unauthenticated users unless guest mode is active.' },
  { type: 'bullet', text: 'API routes call getServerSession and filter records by session.user.id.' },
  { type: 'bullet', text: 'Guest mode is separated from authenticated database users.' },
  { type: 'bullet', text: 'Cart QR payloads are validated with Zod before linking.' },
  { type: 'bullet', text: 'NextAuth secret and database URL are environment variables.' },

  { type: 'h1', text: '14. Project Structure' },
  { type: 'bullet', text: 'app: pages, layouts, route handlers, and global CSS.' },
  { type: 'bullet', text: 'components: UI, layout, list, cart, and receipt components.' },
  { type: 'bullet', text: 'lib: Prisma client, auth, validation, utilities, hooks, and local product dataset.' },
  { type: 'bullet', text: 'store: Zustand active session store and guest list storage.' },
  { type: 'bullet', text: 'prisma: schema, migrations, and seed data.' },
  { type: 'bullet', text: 'public: images, icons, PWA manifest, and generated service worker files.' },
  { type: 'bullet', text: 'types: shared TypeScript interfaces and NextAuth augmentation.' },

  { type: 'h1', text: '15. Major Components' },
  ...components.map((component) => ({ type: 'bullet', text: component })),

  { type: 'h1', text: '16. NPM Scripts' },
  ...scripts.map((script) => ({ type: 'bullet', text: script })),

  { type: 'h1', text: '17. Dependencies' },
  ...dependencies.map((dependency) => ({ type: 'bullet', text: dependency })),

  { type: 'h1', text: '18. Local Setup' },
  { type: 'bullet', text: 'Install dependencies with npm install.' },
  { type: 'bullet', text: 'Configure DATABASE_URL, NEXTAUTH_SECRET, and optionally Stripe keys in .env.' },
  { type: 'bullet', text: 'Generate Prisma client with npm run db:generate.' },
  { type: 'bullet', text: 'Push schema with npm run db:push or run migrations with npm run db:migrate.' },
  { type: 'bullet', text: 'Start development with npm run dev.' },
  { type: 'bullet', text: 'Build production output with npm run build.' },

  { type: 'h1', text: '19. iPhone Camera Testing' },
  { type: 'p', text: 'Phone browsers require HTTPS for camera access. A local network HTTP URL can load the app but will block scanning. The project includes HTTPS and tunnel scripts for mobile testing.' },
  { type: 'bullet', text: 'Recommended mobile path: run npm run dev and npm run tunnel, then open the HTTPS tunnel URL on the iPhone.' },
  { type: 'bullet', text: 'Local HTTPS path: run npm run dev:https, open the HTTPS computer IP URL, and trust the local development certificate if iOS asks.' },
  { type: 'bullet', text: 'Desktop localhost camera testing works from http://localhost:3000 on the same computer.' },

  { type: 'h1', text: '20. Testing and Validation' },
  { type: 'bullet', text: 'Lint command: npm run lint.' },
  { type: 'bullet', text: 'Build command: npm run build.' },
  { type: 'bullet', text: 'Prisma Studio command: npm run db:studio.' },
  { type: 'bullet', text: 'Receipt item scanning can be simulated with POST /api/receipts/:id/items.' },
  { type: 'bullet', text: 'Manual cart linking can be tested with cart ID and pairing code entry.' },

  { type: 'h1', text: '21. Deployment Notes' },
  { type: 'bullet', text: 'Set production DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET, and payment keys.' },
  { type: 'bullet', text: 'Run database migrations before serving production traffic.' },
  { type: 'bullet', text: 'Run npm run build and npm start on the hosting platform.' },
  { type: 'bullet', text: 'Use HTTPS in production for auth, PWA behavior, and camera access.' },

  { type: 'h1', text: '22. Future Enhancements' },
  { type: 'bullet', text: 'WebSocket or server-sent events for true real-time cart updates.' },
  { type: 'bullet', text: 'Production Stripe payment intent integration.' },
  { type: 'bullet', text: 'Store inventory and aisle mapping.' },
  { type: 'bullet', text: 'Advanced analytics and user recommendations.' },
  { type: 'bullet', text: 'Dedicated native mobile app or deeper PWA installation polish.' },
  { type: 'bullet', text: 'Database index review after real usage measurements.' },
];

const pageWidth = 612;
const pageHeight = 792;
const marginX = 54;
const marginTop = 58;
const marginBottom = 54;
const contentWidth = pageWidth - marginX * 2;

function fontSizeFor(type) {
  if (type === 'title') return 24;
  if (type === 'subtitle') return 14;
  if (type === 'h1') return 15;
  if (type === 'small') return 9;
  return 10.5;
}

function lineHeightFor(type) {
  if (type === 'title') return 30;
  if (type === 'subtitle') return 20;
  if (type === 'h1') return 22;
  if (type === 'small') return 13;
  return 15;
}

function sanitize(text) {
  return String(text)
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePdfText(text) {
  return sanitize(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapText(text, size, availableWidth) {
  const clean = sanitize(text);
  const approximateCharWidth = size * 0.51;
  const maxChars = Math.max(18, Math.floor(availableWidth / approximateCharWidth));
  const words = clean.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
    } else if ((current + ' ' + word).length <= maxChars) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

const pages = [[]];
let y = pageHeight - marginTop;

function currentPage() {
  return pages[pages.length - 1];
}

function newPage() {
  pages.push([]);
  y = pageHeight - marginTop;
}

function ensureSpace(height) {
  if (y - height < marginBottom) newPage();
}

function addLine(text, type, indent = 0) {
  const size = fontSizeFor(type);
  const lineHeight = lineHeightFor(type);
  ensureSpace(lineHeight);
  currentPage().push({ text, type, size, x: marginX + indent, y });
  y -= lineHeight;
}

for (const block of blocks) {
  if (block.type === 'gap') {
    y -= 10;
    continue;
  }

  const size = fontSizeFor(block.type);
  const lineHeight = lineHeightFor(block.type);
  const indent = block.type === 'bullet' ? 14 : 0;
  const prefix = block.type === 'bullet' ? '- ' : '';
  const availableWidth = contentWidth - indent;
  const wrapped = wrapText(prefix + block.text, size, availableWidth);
  const blockHeight = wrapped.length * lineHeight + (block.type === 'h1' ? 8 : 2);

  ensureSpace(blockHeight);
  if (block.type === 'h1') y -= 6;
  wrapped.forEach((line) => addLine(line, block.type, indent));
  if (block.type === 'title' || block.type === 'h1') y -= 5;
}

function colorFor(type) {
  if (type === 'title' || type === 'h1') return '0.02 0.38 0.26 rg';
  if (type === 'subtitle') return '0.20 0.24 0.30 rg';
  if (type === 'small') return '0.45 0.49 0.56 rg';
  return '0.08 0.10 0.14 rg';
}

function pageStream(lines, pageIndex, totalPages) {
  const commands = [];
  for (const line of lines) {
    commands.push(
      'BT',
      '/F1 ' + line.size.toFixed(2) + ' Tf',
      colorFor(line.type),
      '1 0 0 1 ' + line.x.toFixed(2) + ' ' + line.y.toFixed(2) + ' Tm',
      '(' + escapePdfText(line.text) + ') Tj',
      'ET'
    );
  }
  commands.push(
    'BT',
    '/F1 8 Tf',
    '0.45 0.49 0.56 rg',
    '1 0 0 1 ' + marginX + ' 30 Tm',
    '(Carto Project Overview - Page ' + (pageIndex + 1) + ' of ' + totalPages + ') Tj',
    'ET'
  );
  return commands.join('\n');
}

function buildPdf() {
  const objects = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  const pageObjectIds = pages.map((_, index) => 4 + index * 2);
  objects.push('<< /Type /Pages /Kids [' + pageObjectIds.map((id) => id + ' 0 R').join(' ') + '] /Count ' + pages.length + ' >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  pages.forEach((page, index) => {
    const pageObjectId = 4 + index * 2;
    const contentObjectId = pageObjectId + 1;
    objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageWidth + ' ' + pageHeight + '] /Resources << /Font << /F1 3 0 R >> >> /Contents ' + contentObjectId + ' 0 R >>');
    const stream = pageStream(page, index, pages.length);
    objects.push('<< /Length ' + Buffer.byteLength(stream, 'utf8') + ' >>\nstream\n' + stream + '\nendstream');
  });

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += (index + 1) + ' 0 obj\n' + object + '\nendobj\n';
  });
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += 'xref\n0 ' + (objects.length + 1) + '\n';
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += String(offset).padStart(10, '0') + ' 00000 n \n';
  });
  pdf += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\n';
  pdf += 'startxref\n' + xrefOffset + '\n%%EOF\n';
  return pdf;
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, buildPdf(), 'binary');
console.log(outputPath);
