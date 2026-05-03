ALTER TABLE "users"
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "password" DROP NOT NULL,
ADD COLUMN "phoneNumber" TEXT,
ADD COLUMN "image" TEXT;

CREATE UNIQUE INDEX "users_phoneNumber_key" ON "users"("phoneNumber");
CREATE INDEX "users_phoneNumber_idx" ON "users"("phoneNumber");
