-- Remove deprecated active-list flag
ALTER TABLE "shopping_lists" DROP COLUMN IF EXISTS "isActive";

