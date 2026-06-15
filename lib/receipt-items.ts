import { calculateTax } from '@/lib/utils';

export type ReceiptLineInput = {
  name: string;
  quantity: number;
  price: number;
  category: string | null;
};

function normalizeReceiptPrice(price: number | null | undefined) {
  return Number.isFinite(price) ? Number(price) : 0;
}

export function buildReceiptItemsFromListItems(
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    category?: string | null;
  }>
): ReceiptLineInput[] {
  return items.map((item) => ({
    name: item.name.trim(),
    quantity: item.quantity,
    price: normalizeReceiptPrice(item.price),
    category: item.category?.trim() || null,
  }));
}

export function calculateReceiptTotals(items: Array<ReceiptLineInput>) {
  const subtotal = items.reduce((sum, item) => sum + normalizeReceiptPrice(item.price) * item.quantity, 0);
  const tax = calculateTax(subtotal);
  const total = subtotal + tax;

  return {
    subtotal,
    tax,
    total,
  };
}
