-- A physical cart can be linked in many sessions over time.
-- The application enforces only one active session per cart in app/api/cart/link/route.ts.
DROP INDEX IF EXISTS "cart_sessions_cartId_key";

CREATE INDEX IF NOT EXISTS "cart_sessions_cartId_idx" ON "cart_sessions"("cartId");
