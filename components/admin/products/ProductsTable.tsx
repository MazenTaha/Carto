'use client';

import { useState } from 'react';
import { Package, Pencil, Trash2 } from 'lucide-react';
import { AdminProduct } from '@/types/admin';
import { DataTable } from '@/components/admin/shared/DataTable';
import { ConfirmDialog } from '@/components/admin/shared/ConfirmDialog';
import { EmptyState } from '@/components/admin/shared/EmptyState';
import { formatCurrency } from '@/lib/utils';

interface ProductsTableProps {
  products: AdminProduct[];
  onEdit: (product: AdminProduct) => void;
  onDelete: (id: string) => Promise<void>;
}

export function ProductsTable({ products, onEdit, onDelete }: ProductsTableProps) {
  const [deleteTarget, setDeleteTarget] = useState<AdminProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (!products.length) {
    return (
      <EmptyState
        icon={<Package />}
        title="No products found"
        description="Try adjusting your search or filters, or add a new product."
      />
    );
  }

  const columns = [
    {
      key: 'name',
      label: 'Product',
      render: (_: unknown, row: AdminProduct) => (
        <div className="flex items-center gap-3">
          <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-xl sm:flex" aria-hidden="true">
            {row.emoji ?? '📦'}
          </span>
          <span className="min-w-0">
            <span className="block max-w-[8.5rem] truncate font-medium capitalize text-ink sm:max-w-[16rem]">{row.name}</span>
            <span className="block max-w-[8.5rem] truncate text-xs text-ink-subtle sm:max-w-none">{row.category}</span>
          </span>
        </div>
      ),
    },
    {
      key: 'price',
      label: 'Price',
      className: 'whitespace-nowrap text-right',
      render: (v: number) => <span className="tabular font-medium text-ink">{formatCurrency(v)}</span>,
    },
    {
      key: 'popularity',
      label: 'Popularity',
      className: 'hidden md:table-cell',
      render: (v: number) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, v)}%` }} />
          </div>
          <span className="tabular text-xs text-ink-muted">{v}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'w-24 !pl-0',
      render: (_: unknown, row: AdminProduct) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(row);
            }}
            className="flex size-9 items-center justify-center rounded-lg text-ink-subtle transition hover:bg-brand-50 hover:text-primary"
            aria-label={`Edit ${row.name}`}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(row);
            }}
            className="flex size-9 items-center justify-center rounded-lg text-ink-subtle transition hover:bg-red-50 hover:text-red-600"
            aria-label={`Delete ${row.name}`}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable columns={columns} data={products} keyField="id" caption="Products" minWidthClassName="min-w-0" />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This cannot be undone. The product will be removed from the catalog."
        confirmLabel="Delete product"
        loading={deleting}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setDeleting(true);
          await onDelete(deleteTarget.id);
          setDeleting(false);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
