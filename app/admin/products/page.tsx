'use client';

import { useState, useCallback } from 'react';
import { useAdminProducts } from '@/hooks/admin/useAdminProducts';
import { ProductsTable } from '@/components/admin/products/ProductsTable';
import { ProductModal } from '@/components/admin/products/ProductModal';
import { PageHeader } from '@/components/admin/shared/PageHeader';
import { LoadingSkeleton } from '@/components/admin/shared/LoadingSkeleton';
import { AdminProduct } from '@/types/admin';
import { Package, Plus, Search } from 'lucide-react';
import { Pagination } from '@/components/admin/shared/Pagination';
import { Toast, useToast } from '@/components/admin/shared/Toast';
import { Button } from '@/components/ui/Button';
import { inputClassName } from '@/components/ui/Input';
import { useDebounce } from '@/lib/hooks';
import { cn } from '@/lib/utils';

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
  const toast = useToast();

  const debouncedQ = useDebounce(q, 350);

  const { products, total, pageSize, isLoading, createProduct, updateProduct, deleteProduct } =
    useAdminProducts({ q: debouncedQ, category, page, pageSize: 15 });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const showToast = toast.show;

  const handleSave = useCallback(async (data: any) => {
    if (editTarget) {
      await updateProduct({ id: editTarget.id, ...data });
      showToast('Product updated');
    } else {
      await createProduct(data);
      showToast('Product added');
    }
  }, [editTarget, createProduct, updateProduct, showToast]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteProduct(id);
    showToast('Product deleted');
  }, [deleteProduct, showToast]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description={isLoading ? 'Loading catalog…' : `${total.toLocaleString()} products in the catalog`}
        icon={Package}
        actions={
          <Button
            onClick={() => {
              setEditTarget(null);
              setModalOpen(true);
            }}
          >
            <Plus aria-hidden="true" />
            Add product
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[1.125rem] -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
          <label htmlFor="product-filter" className="sr-only">
            Search products
          </label>
          <input
            id="product-filter"
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search products…"
            className={cn(inputClassName, 'h-11 pl-11')}
          />
        </div>
        <label htmlFor="category-filter" className="sr-only">
          Category
        </label>
        <select
          id="category-filter"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className={cn(inputClassName, 'h-11 pr-10 sm:w-56')}
        >
          <option value="">All categories</option>
          {CATEGORIES.filter(Boolean).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="surface-card overflow-hidden">
        {isLoading ? (
          <LoadingSkeleton rows={8} />
        ) : (
          <ProductsTable
            products={products}
            onEdit={(p) => {
              setEditTarget(p);
              setModalOpen(true);
            }}
            onDelete={handleDelete}
          />
        )}
      </div>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
      )}

      <ProductModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} initial={editTarget} />

      <Toast message={toast.message} />
    </div>
  );
}
