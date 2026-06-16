'use client';

import { useState, useEffect } from 'react';
import { AdminProduct } from '@/types/admin';
import { X } from 'lucide-react';

const CATEGORIES = [
  'Dairy & Eggs', 'Bakery', 'Produce', 'Meat & Seafood',
  'Frozen Foods', 'Beverages', 'Snacks & Candy', 'Pantry',
  'Personal Care', 'Household', 'Baby', 'Other',
];

interface ProductModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initial?: AdminProduct | null;
}

export function ProductModal({ open, onClose, onSave, initial }: ProductModalProps) {
  const [form, setForm] = useState({
    name: '', category: 'Other', emoji: '', price: '1.00', popularity: '0',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name,
        category: initial.category,
        emoji: initial.emoji ?? '',
        price: String(initial.price),
        popularity: String(initial.popularity),
      });
    } else {
      setForm({ name: '', category: 'Other', emoji: '', price: '1.00', popularity: '0' });
    }
    setError('');
  }, [initial, open]);

  if (!open) return null;

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.price) { setError('Name and price are required.'); return; }
    setSaving(true);
    try {
      await onSave({
        ...(initial ? { id: initial.id } : {}),
        name: form.name.trim(),
        category: form.category,
        emoji: form.emoji || null,
        price: parseFloat(form.price),
        popularity: parseInt(form.popularity) || 0,
      });
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Failed to save product');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            {initial ? 'Edit Product' : 'Add Product'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-semibold text-slate-500">Product Name *</label>
              <input
                value={form.name} onChange={set('name')} required
                placeholder="e.g. Whole Milk"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Emoji</label>
              <input
                value={form.emoji} onChange={set('emoji')}
                placeholder="🥛"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-lg outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">Category *</label>
            <select
              value={form.category} onChange={set('category')}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            >
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Price (EGP) *</label>
              <input
                type="number" min="0" step="0.01" value={form.price} onChange={set('price')} required
                placeholder="1.00"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Popularity (0–100)</label>
              <input
                type="number" min="0" max="100" value={form.popularity} onChange={set('popularity')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : initial ? 'Save Changes' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
