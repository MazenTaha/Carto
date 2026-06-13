-- Add Paymob-backed payment attempts and switch the default store currency to EGP.

CREATE TYPE "PaymentAttemptStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'EXPIRED'
);

ALTER TABLE "stores"
ALTER COLUMN "currency" SET DEFAULT 'EGP';

CREATE TABLE "payment_attempts" (
  "id" TEXT NOT NULL,
  "receiptId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT,
  "guestSessionId" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'PAYMOB',
  "merchantOrderId" TEXT NOT NULL,
  "providerOrderId" TEXT,
  "providerTransactionId" TEXT,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EGP',
  "checkoutUrl" TEXT,
  "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'PENDING',
  "lastError" TEXT,
  "rawResponse" JSONB,
  "rawWebhook" JSONB,
  "metadata" JSONB,
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_attempts_merchantOrderId_key" ON "payment_attempts"("merchantOrderId");
CREATE UNIQUE INDEX "payment_attempts_providerOrderId_key" ON "payment_attempts"("providerOrderId");
CREATE UNIQUE INDEX "payment_attempts_providerTransactionId_key" ON "payment_attempts"("providerTransactionId");
CREATE INDEX "payment_attempts_receiptId_idx" ON "payment_attempts"("receiptId");
CREATE INDEX "payment_attempts_sessionId_idx" ON "payment_attempts"("sessionId");
CREATE INDEX "payment_attempts_userId_idx" ON "payment_attempts"("userId");
CREATE INDEX "payment_attempts_guestSessionId_idx" ON "payment_attempts"("guestSessionId");
CREATE INDEX "payment_attempts_status_idx" ON "payment_attempts"("status");

ALTER TABLE "payment_attempts"
ADD CONSTRAINT "payment_attempts_receiptId_fkey"
FOREIGN KEY ("receiptId") REFERENCES "receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
