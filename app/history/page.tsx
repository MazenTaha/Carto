import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { formatCurrency } from '@/lib/utils';

export default async function HistoryPage() {
  let session = null;
  const cookieStore = await cookies();
  const guestMode = cookieStore.get('guest_mode')?.value === 'true';

  if (!guestMode && process.env.NEXTAUTH_SECRET && process.env.DATABASE_URL) {
    try {
      const { getServerSession } = await import('next-auth');
      const { authOptions } = await import('@/lib/auth-config');
      session = await getServerSession(authOptions);
    } catch (error) {}
  }

  if (!session && !guestMode) {
    redirect('/auth/signin');
  }

  let receipts = [
    { id: '1', total: 42.78, createdAt: new Date('2023-10-24'), _count: { items: 12 }, store: 'Carto Supermarket' },
    { id: '2', total: 124.50, createdAt: new Date('2023-10-18'), _count: { items: 28 }, store: 'Whole Foods Market' },
    { id: '3', total: 15.20, createdAt: new Date('2023-10-12'), _count: { items: 3 }, store: 'Local Bakery Corner' },
  ];

  return (
    <PageContainer>
      <Header title="Purchase History" showBack={true} />
      <div className="bg-white dark:bg-background-dark">
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-4 gap-8">
          <a className="flex flex-col items-center justify-center border-b-[3px] border-primary text-primary pb-3 pt-4" href="#">
            <p className="text-sm font-bold leading-normal">Recent</p>
          </a>
          <a className="flex flex-col items-center justify-center border-b-[3px] border-transparent text-slate-500 dark:text-slate-400 pb-3 pt-4" href="#">
            <p className="text-sm font-bold leading-normal">Archived</p>
          </a>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pb-32">
        <h3 className="text-slate-900 dark:text-slate-100 text-base font-bold leading-tight px-4 pb-2 pt-6 uppercase tracking-wider">October 2023</h3>
        <div className="px-4 flex flex-col gap-4 py-2">
          {receipts.map((receipt) => (
            <div key={receipt.id} className="flex items-stretch justify-between gap-4 rounded-lg bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-100 dark:border-slate-800">
              <div className="flex flex-[2_2_0px] flex-col justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <p className="text-primary text-lg font-bold leading-tight">{formatCurrency(receipt.total)}</p>
                  <p className="text-slate-900 dark:text-slate-100 text-base font-bold">{receipt.store}</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">
                    {receipt.createdAt.toLocaleDateString()} • {receipt._count.items} items
                  </p>
                </div>
                <button className="flex min-w-[84px] cursor-pointer items-center justify-center rounded-lg h-9 px-4 bg-primary/10 text-primary hover:bg-primary/20 transition-colors gap-2 text-sm font-semibold">
                  <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                  <span className="truncate">View Receipt</span>
                </button>
              </div>
              <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-lg flex-shrink-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-slate-300">image</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </PageContainer>
  );
}
