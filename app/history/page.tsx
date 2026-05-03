import { redirect } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency } from '@/lib/utils';
import { ownerWhere, requireUserOrGuest } from '@/lib/guest-session';

export default async function HistoryPage() {
  const owner = process.env.DATABASE_URL ? await requireUserOrGuest() : null;

  if (!owner) {
    redirect('/auth/signin');
  }

  let receipts: any[] = [];

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import('@/lib/prisma');
      receipts = await prisma.receipt.findMany({
        where: {
          ...ownerWhere(owner),
          status: 'PAID',
        },
        select: {
          id: true,
          total: true,
          createdAt: true,
          items: {
            select: { quantity: true },
          },
          store: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {}
  }

  return (
    <PageContainer maxWidth="lg">
      <Header title="Latest Receipts" showBack />

      <main className="flex-1 pb-32 pt-6 md:pb-10">
        <section className="mb-6 rounded-3xl bg-slate-950 p-6 text-white shadow-soft">
          <Badge className="bg-white/10 text-white ring-white/15">Paid receipts only</Badge>
          <h1 className="mt-4 text-3xl font-black tracking-tight">Final transactions</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
            History shows only completed checkout receipts from finished shopping sessions.
          </p>
        </section>

        {receipts.length === 0 ? (
          <EmptyState
            icon="receipt_long"
            title="No final receipts yet"
            description="Complete a checkout and the latest receipt will appear here."
            actionLabel="Start shopping"
            actionHref="/lists?activate=1"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {receipts.map((receipt) => {
              const itemCount = receipt.items.reduce(
                (sum: number, item: any) => sum + item.quantity,
                0
              );
              const storeName = receipt.store?.name || 'Carto Store';

              return (
                <article
                  key={receipt.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-2xl font-black leading-tight text-primary">
                        {formatCurrency(receipt.total)}
                      </p>
                      <h2 className="mt-2 truncate text-lg font-black text-slate-950 dark:text-slate-100">
                        {storeName}
                      </h2>
                      <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                        {new Date(receipt.createdAt).toLocaleDateString()} · {itemCount} products
                      </p>
                    </div>
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <span className="material-symbols-outlined text-3xl">receipt_long</span>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                    <Badge variant="success">Final receipt</Badge>
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      #{receipt.id.slice(-6).toUpperCase()}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav />
    </PageContainer>
  );
}
