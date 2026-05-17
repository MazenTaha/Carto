'use client';

import { useAdminCarts } from '@/hooks/admin/useAdminCarts';
import { CartsGrid } from '@/components/admin/carts/CartsGrid';
import { PageHeader } from '@/components/admin/shared/PageHeader';
import { LoadingSkeleton } from '@/components/admin/shared/LoadingSkeleton';
import { EmptyState } from '@/components/admin/shared/EmptyState';
import { ShoppingCart, RefreshCw } from 'lucide-react';
import { useState } from 'react';

const STATUS_FILTERS = ['All', 'AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OFFLINE'];

export default function CartsPage() {
  const { carts, isLoading, error, resetCart, setStatus, generateQR } = useAdminCarts();
  const [filter, setFilter] = useState('All');
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const filtered = filter === 'All' ? carts : carts.filter((c) => c.status === filter);

  const counts = STATUS_FILTERS.slice(1).reduce((acc, s) => {
    acc[s] = carts.filter((c) => c.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cart Management"
        description={`${carts.length} carts in fleet`}
        icon={ShoppingCart}
        actions={
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <RefreshCw size={11} /> Auto-refreshes every 10s
          </span>
        }
      />

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
              filter === s
                ? 'bg-indigo-600 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {s.replace('_', ' ')}
            {s !== 'All' && counts[s] != null && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                filter === s ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {counts[s]}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={8} />
      ) : error ? (
        <EmptyState title="Failed to load carts" description={error.message} icon={<ShoppingCart size={22} />} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart size={22} />}
          title={filter === 'All' ? 'No carts configured' : `No ${filter.replace('_', ' ').toLowerCase()} carts`}
          description="Carts are added by connecting physical devices to the system."
        />
      ) : (
        <CartsGrid
          carts={filtered}
          onReset={async (id) => { await resetCart(id); showToast('Cart reset successfully'); }}
          onSetStatus={async (id, status) => { await setStatus(id, status); showToast(`Status updated to ${status}`); }}
          onGenerateQR={generateQR}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
