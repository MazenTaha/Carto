import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { ReceiptText } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { EmptyState } from '@/components/ui/EmptyState';
import { Logo } from '@/components/ui/Logo';
import { PageHeader } from '@/components/ui/PageHeader';
import { ReceiptDivider, ReceiptPanel } from '@/components/ui/ReceiptPanel';
import { DEMO_PAYMENT_AMOUNT_EGP, DEMO_PAYMENT_CURRENCY } from '@/lib/constants/demo-payment';
import { formatPaymentCurrency } from '@/lib/payment-money';
import { formatCurrency } from '@/lib/utils';
import { ownerWhere, requireUserOrGuest } from '@/lib/guest-session';
import { prisma } from '@/lib/prisma';

export default async function ReceiptDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const owner = process.env.DATABASE_URL ? await requireUserOrGuest() : null;
  const demoAmountLabel = formatPaymentCurrency(DEMO_PAYMENT_AMOUNT_EGP, DEMO_PAYMENT_CURRENCY);

  if (!owner) {
    redirect('/auth/signin');
  }

  let receipt: {
    id: string;
    total: number;
    subtotal: number;
    tax: number;
    status: string;
    paymentStatus: string;
    paymentMethod: string;
    createdAt: Date;
    lockedAt: Date | null;
    items: Array<{ id: string; name: string; quantity: number; price: number; category: string | null }>;
    cartSession: {
      cart: { cartCode: string } | null;
      shoppingList: { name: string } | null;
    } | null;
  } | null = null;

  if (process.env.DATABASE_URL) {
    try {
      receipt = await prisma.receipt.findFirst({
        where: {
          id: params.id,
          ...ownerWhere(owner),
          status: 'PAID',
          paymentStatus: 'COMPLETED',
          cartSession: {
            is: {
              status: 'CHECKED_OUT',
              endedAt: {
                not: null,
              },
            },
          },
        },
        select: {
          id: true,
          total: true,
          subtotal: true,
          tax: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          createdAt: true,
          lockedAt: true,
          items: {
            select: {
              id: true,
              name: true,
              quantity: true,
              price: true,
              category: true,
            },
            orderBy: { scannedAt: 'desc' },
          },
          cartSession: {
            select: {
              cart: {
                select: {
                  cartCode: true,
                },
              },
              shoppingList: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {}
  }

  if (!receipt) {
    return (
      <AppShell back="/history" title="Receipt" maxWidth="md">
        <EmptyState
          icon={ReceiptText}
          title="Receipt not found"
          description="We could not find that completed receipt for this account."
          actionLabel="Back to receipts"
          actionHref="/history"
        />
      </AppShell>
    );
  }

  const createdAt = new Date(receipt.createdAt);
  const itemsSubtotal = receipt.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <AppShell back="/history" title={`Receipt #${receipt.id.slice(-6).toUpperCase()}`} maxWidth="md">
      <PageHeader
        eyebrow={
          <Badge tone="success" dot>
            Paid
          </Badge>
        }
        title={receipt.cartSession?.shoppingList?.name || 'Completed shopping session'}
        description={
          <time dateTime={createdAt.toISOString()}>{format(createdAt, "EEEE d MMMM yyyy 'at' HH:mm")}</time>
        }
      />

      <ReceiptPanel className="mt-6">
        <div className="flex items-center justify-between gap-4 px-5 pb-4 pt-5 sm:px-6">
          <Logo height={22} />
          <span className="font-mono text-sm text-ink-subtle">#{receipt.id.slice(-6).toUpperCase()}</span>
        </div>
        <ReceiptDivider />

        <DescriptionList
          layout="grid"
          className="grid-cols-3 gap-2 px-5 py-4 sm:gap-3 sm:px-6"
          items={[
            { label: 'Cart', value: receipt.cartSession?.cart?.cartCode || 'Carto cart', mono: true },
            { label: 'Payment', value: <span className="capitalize">{receipt.paymentStatus.replace('_', ' ').toLowerCase()}</span> },
            { label: 'Method', value: <span className="capitalize">{receipt.paymentMethod.toLowerCase()}</span> },
          ]}
        />
        <ReceiptDivider />

        <section aria-labelledby="receipt-items" className="px-5 py-4 sm:px-6">
          <h2 id="receipt-items" className="eyebrow mb-3">
            {receipt.items.length} item line{receipt.items.length === 1 ? '' : 's'}
          </h2>
          {receipt.items.length === 0 ? (
            <p className="text-sm text-ink-subtle">No items were scanned in this session.</p>
          ) : (
            <ul className="space-y-3">
              {receipt.items.map((item) => (
                <li key={item.id} className="flex items-baseline justify-between gap-4 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{item.name}</p>
                    <p className="tabular text-xs text-ink-subtle">
                      {item.quantity} × {formatCurrency(item.price)} · {item.category || 'General'}
                    </p>
                  </div>
                  <p className="tabular shrink-0 font-medium text-ink">{formatCurrency(item.price * item.quantity)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <ReceiptDivider />

        <div className="space-y-2 px-5 py-4 text-sm sm:px-6">
          <div className="flex justify-between text-ink-muted">
            <span>Items subtotal</span>
            <span className="tabular">{formatCurrency(itemsSubtotal)}</span>
          </div>
          <div className="flex justify-between text-ink-muted">
            <span>Tax</span>
            <span className="tabular">{formatPaymentCurrency(0, DEMO_PAYMENT_CURRENCY)}</span>
          </div>
          <div className="flex items-baseline justify-between pt-2">
            <span className="font-semibold text-ink">
              Amount paid <span className="font-normal text-ink-subtle">(test mode)</span>
            </span>
            <span className="tabular font-display text-2xl font-semibold text-ink">{demoAmountLabel}</span>
          </div>
        </div>
      </ReceiptPanel>
    </AppShell>
  );
}
