import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
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
    <PageContainer maxWidth="lg">
      <Header title="Receipt History" showBack />

      <main className="flex-1 pb-32 pt-6 md:pb-10">
        <section className="mb-6 rounded-3xl bg-slate-950 p-6 text-white shadow-soft">
          <Badge className="bg-white/10 text-white ring-white/15">Completed receipts</Badge>
          <h1 className="mt-4 text-3xl font-black tracking-tight">Your finished shopping history</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
            Browse only completed receipt records from your finished Carto shopping sessions.
          </p>
        </section>

        {receipts.length === 0 ? (
          <EmptyState
            icon="receipt_long"
            title="No receipts yet"
            description="Your completed shopping sessions will appear here."
            actionLabel="Start shopping"
            actionHref="/lists?activate=1"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {receipts.map((receipt) => (
              <article
                key={receipt.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      Receipt #{receipt.receiptNumber}
                    </p>
                    <p className="mt-2 text-2xl font-black leading-tight text-primary">
                      {demoAmountLabel}
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                      {new Date(receipt.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-3xl">receipt_long</span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950">
                    <p className="font-bold text-slate-500">Shopping list</p>
                    <p className="mt-1 truncate font-black text-slate-950 dark:text-slate-100">
                      {receipt.listName || 'Saved shopping list'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950">
                    <p className="font-bold text-slate-500">Cart code</p>
                    <p className="mt-1 truncate font-black text-slate-950 dark:text-slate-100">
                      {receipt.cartCode || 'Carto cart'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950">
                    <p className="font-bold text-slate-500">Items</p>
                    <p className="mt-1 font-black text-slate-950 dark:text-slate-100">
                      {receipt.itemsCount} item{receipt.itemsCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950">
                    <p className="font-bold text-slate-500">Payment status</p>
                    <p className="mt-1 font-black text-slate-950 dark:text-slate-100">
                      {receipt.paymentStatus.replace('_', ' ')}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                  <Badge variant="success">{receipt.status}</Badge>
                  <Link
                    href={`/receipts/${receipt.id}`}
                    className="inline-flex items-center gap-2 text-sm font-black text-primary transition hover:underline"
                  >
                    View receipt
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </PageContainer>
  );
}
