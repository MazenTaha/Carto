export const LIST_RETENTION_DAYS = 30;

export function getPermanentDeleteAt(deletedAt = new Date()): Date {
  const permanentDeleteAt = new Date(deletedAt);
  permanentDeleteAt.setDate(permanentDeleteAt.getDate() + LIST_RETENTION_DAYS);
  return permanentDeleteAt;
}

export function getDaysUntilPermanentDelete(permanentDeleteAt: Date | string): number {
  const target = new Date(permanentDeleteAt).getTime();
  const now = Date.now();
  const remainingMs = Math.max(0, target - now);
  return Math.max(1, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
}

export async function purgeExpiredShoppingLists(
  prisma: any,
  ownerWhere: Record<string, string | null> = {}
) {
  const now = new Date();

  await prisma.shoppingList.deleteMany({
    where: {
      permanentDeleteAt: { lte: now },
      ...ownerWhere,
    },
  });
}
