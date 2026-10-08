'use client';

import { useAdminCarts } from '@/hooks/admin/useAdminCarts';
import { CartsGrid } from '@/components/admin/carts/CartsGrid';
import { PageHeader } from '@/components/admin/shared/PageHeader';
import { LoadingSkeleton } from '@/components/admin/shared/LoadingSkeleton';
import { EmptyState } from '@/components/admin/shared/EmptyState';
import { CircleAlert, ShoppingCart } from 'lucide-react';
import { Toast, useToast } from '@/components/admin/shared/Toast';
import { ChipTabs } from '@/components/ui/ChipTabs';
import { useState } from 'react';

const STATUS_FILTERS = ['All', 'AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OFFLINE'];

export default function CartsPage() {
  const { carts, isLoading, error, resetCart, setStatus, generateQR } = useAdminCarts();
  const [filter, setFilter] = useState('All');
  const toast = useToast();

  const filtered = filter === 'All' ? carts : carts.filter((c) => c.status === filter);

  const counts = STATUS_FILTERS.slice(1).reduce((acc, s) => {
    acc[s] = carts.filter((c) => c.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Carts"
        description={`${carts.length} cart${carts.length === 1 ? '' : 's'} in the fleet · refreshes every 10s`}
        icon={ShoppingCart}
      />

      <ChipTabs
        ariaLabel="Filter by status"
        value={filter}
        onChange={setFilter}
        options={STATUS_FILTERS.map((s) => ({
          value: s,
          label: s === 'All' ? 'All' : s.replace('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()),
          count: s === 'All' ? carts.length : counts[s],
        }))}
      />

      {isLoading ? (
        <div className="surface-card overflow-hidden">
          <LoadingSkeleton rows={6} />
        </div>
      ) : error ? (
        <div className="surface-card">
          <EmptyState tone="danger" icon={<CircleAlert />} title="Could not load carts" description={error.message} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            icon={<ShoppingCart />}
            title={filter === 'All' ? 'No carts configured' : `No ${filter.replace('_', ' ').toLowerCase()} carts`}
            description="Carts appear here once a device is provisioned for a store."
          />
        </div>
      ) : (
        <CartsGrid
          carts={filtered}
          onReset={async (id) => {
            await resetCart(id);
            toast.show('Cart reset');
          }}
          onSetStatus={async (id, status) => {
            await setStatus(id, status);
            toast.show(`Status set to ${status.replace('_', ' ').toLowerCase()}`);
          }}
          onGenerateQR={generateQR}
        />
      )}

      <Toast message={toast.message} />
    </div>
  );
}
