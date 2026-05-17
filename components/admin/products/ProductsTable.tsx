'use client';

import { useState } from 'react';
import { AdminProduct } from '@/types/admin';
import { DataTable } from '@/components/admin/shared/DataTable';
import { StatusBadge } from '@/components/admin/shared/StatusBadge';
import { ConfirmDialog } from '@/components/admin/shared/ConfirmDialog';
import { EmptyState } from '@/components/admin/shared/EmptyState';
import { Pencil, Trash2, Package } from 'lucide-react';

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
        icon={<Package size={22} />}
        title="No products found"
        description="Try adjusting your search or filters, or add a new product."
      />
    );
  }

  const columns = [
    {
      key: 'name',
      label: 'Product',
      render: (_: any, row: AdminProduct) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-xl">
            {row.emoji ?? '📦'}
          </div>
          <div>
            <p className="font-medium text-slate-900">{row.name}</p>
            <p className="text-xs text-slate-400">{row.category}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'price',
      label: 'Price',
      render: (v: number) => (
        <span className="font-semibold text-slate-800">${v.toFixed(2)}</span>
      ),
    },
    {
      key: 'popularity',
      label: 'Popularity',
      render: (v: number) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 rounded-full bg-slate-100">
            <div
              className="h-1.5 rounded-full bg-indigo-500"
              style={{ width: `${Math.min(100, v)}%` }}
            />
          </div>
          <span className="text-xs text-slate-500">{v}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (_: any, row: AdminProduct) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(row); }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable columns={columns} data={products} keyField="id" />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This action cannot be undone. The product will be removed from the catalog."
        confirmLabel="Delete Product"
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
