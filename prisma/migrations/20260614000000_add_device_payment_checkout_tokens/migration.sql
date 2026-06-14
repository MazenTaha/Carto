ALTER TABLE "receipts"
ADD COLUMN "paidAt" TIMESTAMP(3);

ALTER TABLE "payment_attempts"
ADD COLUMN "paymentTokenHash" TEXT,
ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE INDEX "payment_attempts_expiresAt_idx" ON "payment_attempts"("expiresAt");
