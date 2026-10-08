import Link from 'next/link';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { ChevronRight, ReceiptText } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { DEMO_PAYMENT_AMOUNT_EGP, DEMO_PAYMENT_CURRENCY } from '@/lib/constants/demo-payment';
import { requireUserOrGuest } from '@/lib/guest-session';
import { getCompletedReceiptHistory } from '@/lib/receipt-history';
import { formatPaymentCurrency } from '@/lib/payment-money';

export default async function HistoryPage() {
  const owner = process.env.DATABASE_URL ? await requireUserOrGuest() : null;
  const demoAmountLabel = formatPaymentCurrency(DEMO_PAYMENT_AMOUNT_EGP, DEMO_PAYMENT_CURRENCY);

  if (!owner) {
    redirect('/auth/signin');
  }

  let receipts: Awaited<ReturnType<typeof getCompletedReceiptHistory>> = [];

  if (process.env.DATABASE_URL) {
    try {
      receipts = await getCompletedReceiptHistory(owner);
    } catch (error) {}
  }

  return (
    <AppShell>
      <PageHeader
        title="Receipts"
        description="Every paid shopping session, with the items the cart scanned."
        eyebrow={receipts.length > 0 ? <Badge tone="neutral">{receipts.length} completed</Badge> : undefined}
      />

      <div className="mt-8">
        {receipts.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="No receipts yet"
            description="When you finish and pay for a shopping session, the receipt will appear here."
            actionLabel="Start shopping"
            actionHref="/lists?activate=1"
          />
        ) : (
          <ul className="surface-card divide-y divide-line overflow-hidden">
            {receipts.map((receipt) => {
              const createdAt = new Date(receipt.createdAt);

              return (
                <li key={receipt.id}>
                  <Link
                    href={`/receipts/${receipt.id}`}
                    className="group flex items-center gap-4 px-4 py-4 transition hover:bg-surface-muted sm:px-5"
                  >
                    <span className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-primary sm:flex">
                      <ReceiptText className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-ink">{receipt.listName || 'Shopping session'}</p>
                        <Badge tone="success" className="hidden sm:inline-flex">
                          {receipt.status === 'PAID' ? 'Paid' : receipt.status}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-ink-subtle">
                        <time dateTime={createdAt.toISOString()}>{format(createdAt, 'd MMM yyyy, HH:mm')}</time>
                        {' · '}
                        {receipt.itemsCount} item{receipt.itemsCount === 1 ? '' : 's'}
                        <span className="hidden sm:inline">
                          {' · '}
                          {receipt.cartCode || 'Carto cart'}
                        </span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tabular font-semibold text-ink">{demoAmountLabel}</p>
                      <p className="font-mono text-xs text-ink-subtle">#{receipt.receiptNumber}</p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-ink-subtle transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
