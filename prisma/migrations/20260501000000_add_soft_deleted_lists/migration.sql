ALTER TABLE "shopping_lists"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "permanentDeleteAt" TIMESTAMP(3);

CREATE INDEX "shopping_lists_userId_deletedAt_idx" ON "shopping_lists"("userId", "deletedAt");
CREATE INDEX "shopping_lists_permanentDeleteAt_idx" ON "shopping_lists"("permanentDeleteAt");
