-- Add dynamic physical-cart metadata for QR based linking.
ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "bluetoothName" TEXT;
ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "pairingCode" TEXT;
ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "qrSessionId" TEXT;
ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Store the temporary session identifier emitted by a cart QR payload.
ALTER TABLE "cart_sessions" ADD COLUMN IF NOT EXISTS "externalSessionId" TEXT;

CREATE INDEX IF NOT EXISTS "cart_sessions_externalSessionId_idx" ON "cart_sessions"("externalSessionId");
