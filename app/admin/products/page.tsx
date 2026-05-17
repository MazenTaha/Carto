'use client';

import { useState, useCallback } from 'react';
import { useAdminProducts } from '@/hooks/admin/useAdminProducts';
import { ProductsTable } from '@/components/admin/products/ProductsTable';
import { ProductModal } from '@/components/admin/products/ProductModal';
import { PageHeader } from '@/components/admin/shared/PageHeader';
import { LoadingSkeleton } from '@/components/admin/shared/LoadingSkeleton';
import { AdminProduct } from '@/types/admin';
import { Package, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDebounce } from '@/lib/hooks';

const CATEGORIES = [
  '', 'Dairy & Eggs', 'Bakery', 'Produce', 'Meat & Seafood',
  'Frozen Foods', 'Beverages', 'Snacks & Candy', 'Pantry',
  'Personal Care', 'Household', 'Baby', 'Other',
];

export default function ProductsPage() {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminProduct | null>(null);
  const [toast, setToast] = useState('');

  const debouncedQ = useDebounce(q, 350);

  const { products, total, pageSize, isLoading, createProduct, updateProduct, deleteProduct } =
    useAdminProducts({ q: debouncedQ, category, page, pageSize: 15 });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleSave = useCallback(async (data: any) => {
    if (editTarget) {
      await updateProduct({ id: editTarget.id, ...data });
      showToast('Product updated');
    } else {
      await createProduct(data);
      showToast('Product added');
    }
  }, [editTarget, createProduct, updateProduct]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteProduct(id);
    showToast('Product deleted');
  }, [deleteProduct]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description={`${total} products in catalog`}
        icon={Package}
        actions={
          <button
            onClick={() => { setEditTarget(null); setModalOpen(true); }}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            <Plus size={16} /> Add Product
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Search products…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        >
          <option value="">All Categories</option>
          {CATEGORIES.filter(Boolean).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-100 bg-white p-1 shadow-sm">
        {isLoading ? (
          <div className="p-4"><LoadingSkeleton rows={8} /></div>
        ) : (
          <ProductsTable
            products={products}
            onEdit={(p) => { setEditTarget(p); setModalOpen(true); }}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Page {page} of {totalPages} · {total} results</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      <ProductModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initial={editTarget}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg animate-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </div>
  );
}
