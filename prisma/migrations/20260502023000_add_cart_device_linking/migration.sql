ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "deviceSecret" TEXT;
ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "pairingExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "carts_deviceSecret_key" ON "carts"("deviceSecret");
CREATE INDEX IF NOT EXISTS "carts_pairingExpiresAt_idx" ON "carts"("pairingExpiresAt");
