import { AdminShell } from '@/components/admin/layout/AdminShell';

export const metadata = {
  title: { template: '%s | Carto Admin', default: 'Carto Admin' },
  description: 'Carto Smart Retail Admin Dashboard',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
