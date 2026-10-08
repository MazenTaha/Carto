'use client';

import { useState, useEffect } from 'react';
import { AdminProduct } from '@/types/admin';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input, inputClassName } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

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
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title={initial ? 'Edit product' : 'Add product'}
      description={initial ? 'Changes apply to the catalog immediately.' : 'New products appear in shopper search right away.'}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="product-form" loading={saving}>
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Add product'}
          </Button>
        </div>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} noValidate className="space-y-4 pt-2">
        {error && <Alert tone="danger">{error}</Alert>}

        <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-3">
          <Input label="Product name" value={form.name} onChange={set('name')} required placeholder="e.g. Whole milk" autoFocus />
          <Input label="Emoji" value={form.emoji} onChange={set('emoji')} placeholder="🥛" className="text-center text-lg" maxLength={4} />
        </div>

        <div>
          <label htmlFor="product-category" className="mb-1.5 block text-sm font-medium text-ink">
            Category
          </label>
          <select id="product-category" value={form.category} onChange={set('category')} className={cn(inputClassName, 'pr-10')}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Price (EGP)"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={form.price}
            onChange={set('price')}
            required
            placeholder="1.00"
          />
          <Input
            label="Popularity"
            hint="0 – 100"
            type="number"
            min="0"
            max="100"
            inputMode="numeric"
            value={form.popularity}
            onChange={set('popularity')}
          />
        </div>
      </form>
    </Modal>
  );
}
