import { redirect } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency } from '@/lib/utils';
import { ownerWhere, requireUserOrGuest } from '@/lib/guest-session';
import { prisma } from '@/lib/prisma';

export default async function ReceiptDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const owner = process.env.DATABASE_URL ? await requireUserOrGuest() : null;

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
      <PageContainer maxWidth="lg">
        <Header title="Receipt" showBack />
        <main className="flex-1 pb-32 pt-6 md:pb-10">
          <EmptyState
            icon="receipt_long"
            title="Receipt not found"
            description="We could not find that completed receipt for this account."
            actionLabel="Back to history"
            actionHref="/history"
          />
        </main>
        <BottomNav />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="lg">
      <Header title="Receipt" showBack />

      <main className="flex-1 pb-32 pt-6 md:pb-10">
        <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-soft">
          <Badge className="bg-white/10 text-white ring-white/15">Receipt #{receipt.id.slice(-6).toUpperCase()}</Badge>
          <h1 className="mt-4 text-3xl font-black tracking-tight">{formatCurrency(receipt.total)}</h1>
          <p className="mt-2 text-sm leading-6 text-white/70">
            {new Date(receipt.createdAt).toLocaleString()} · {receipt.cartSession?.shoppingList?.name || 'Completed shopping session'}
          </p>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Status</p>
            <p className="mt-2 text-lg font-black text-slate-950 dark:text-slate-100">{receipt.status}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Payment</p>
            <p className="mt-2 text-lg font-black text-slate-950 dark:text-slate-100">{receipt.paymentStatus.replace('_', ' ')}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Cart code</p>
            <p className="mt-2 text-lg font-black text-slate-950 dark:text-slate-100">{receipt.cartSession?.cart?.cartCode || 'Carto cart'}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Payment method</p>
            <p className="mt-2 text-lg font-black text-slate-950 dark:text-slate-100">{receipt.paymentMethod}</p>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-950 dark:text-slate-100">Receipt items</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {receipt.items.length} item line{receipt.items.length === 1 ? '' : 's'} in this completed receipt.
              </p>
            </div>
            <Badge variant="success">Paid</Badge>
          </div>

          <div className="mt-5 space-y-3">
            {receipt.items.map((item) => (
              <article
                key={item.id}
                className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950"
              >
                <div className="min-w-0">
                  <p className="truncate font-black text-slate-950 dark:text-slate-100">{item.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.category || 'General'} · Qty {item.quantity}
                  </p>
                </div>
                <p className="shrink-0 font-black text-slate-950 dark:text-slate-100">
                  {formatCurrency(item.price * item.quantity)}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-6 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-bold text-slate-950 dark:text-slate-100">{formatCurrency(receipt.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Tax</span>
              <span className="font-bold text-slate-950 dark:text-slate-100">{formatCurrency(receipt.tax)}</span>
            </div>
            <div className="flex items-center justify-between text-base">
              <span className="font-black text-slate-950 dark:text-slate-100">Total</span>
              <span className="text-2xl font-black text-primary">{formatCurrency(receipt.total)}</span>
            </div>
          </div>
        </section>
      </main>

      <BottomNav />
    </PageContainer>
  );
}
