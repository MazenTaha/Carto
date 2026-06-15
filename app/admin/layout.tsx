import { AdminSidebar } from '@/components/admin/layout/AdminSidebar';
import { AdminTopNav } from '@/components/admin/layout/AdminTopNav';
import { Providers } from '@/app/providers';

export const metadata = {
  title: { template: '%s | Carto Admin', default: 'Carto Admin' },
  description: 'Carto Smart Retail Admin Dashboard',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
        <AdminSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AdminTopNav />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-7xl px-6 py-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </Providers>
  );
}
