ALTER TABLE "cart_sessions"
ADD COLUMN IF NOT EXISTS "guestSessionId" TEXT;

ALTER TABLE "cart_sessions"
ALTER COLUMN "userId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "cart_sessions_guestSessionId_idx"
ON "cart_sessions"("guestSessionId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cart_sessions_guestSessionId_fkey'
  ) THEN
    ALTER TABLE "cart_sessions"
    ADD CONSTRAINT "cart_sessions_guestSessionId_fkey"
    FOREIGN KEY ("guestSessionId")
    REFERENCES "guest_sessions"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cart_sessions_owner_check'
  ) THEN
    ALTER TABLE "cart_sessions"
    ADD CONSTRAINT "cart_sessions_owner_check"
    CHECK (
      ("userId" IS NOT NULL AND "guestSessionId" IS NULL)
      OR
      ("userId" IS NULL AND "guestSessionId" IS NOT NULL)
    );
  END IF;
END $$;
