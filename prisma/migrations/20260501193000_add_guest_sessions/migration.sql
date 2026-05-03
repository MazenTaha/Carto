CREATE TABLE "guest_sessions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "guest_sessions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "shopping_lists" ADD COLUMN "guestSessionId" TEXT;
ALTER TABLE "cart_sessions" ADD COLUMN "guestSessionId" TEXT;
ALTER TABLE "receipts" ADD COLUMN "guestSessionId" TEXT;

ALTER TABLE "shopping_lists" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "cart_sessions" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "receipts" ALTER COLUMN "userId" DROP NOT NULL;

CREATE INDEX "guest_sessions_expiresAt_idx" ON "guest_sessions"("expiresAt");
CREATE INDEX "shopping_lists_guestSessionId_idx" ON "shopping_lists"("guestSessionId");
CREATE INDEX "shopping_lists_guestSessionId_deletedAt_idx" ON "shopping_lists"("guestSessionId", "deletedAt");
CREATE INDEX "cart_sessions_guestSessionId_idx" ON "cart_sessions"("guestSessionId");
CREATE INDEX "receipts_guestSessionId_idx" ON "receipts"("guestSessionId");

ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "guest_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cart_sessions" ADD CONSTRAINT "cart_sessions_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "guest_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "guest_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_owner_check" CHECK (("userId" IS NOT NULL AND "guestSessionId" IS NULL) OR ("userId" IS NULL AND "guestSessionId" IS NOT NULL));
ALTER TABLE "cart_sessions" ADD CONSTRAINT "cart_sessions_owner_check" CHECK (("userId" IS NOT NULL AND "guestSessionId" IS NULL) OR ("userId" IS NULL AND "guestSessionId" IS NOT NULL));
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_owner_check" CHECK (("userId" IS NOT NULL AND "guestSessionId" IS NULL) OR ("userId" IS NULL AND "guestSessionId" IS NOT NULL));
