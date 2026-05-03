'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Receipt, ReceiptItem } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ReceiptPanel } from '@/components/ui/ReceiptPanel';
import { calculateTax, formatCurrency } from '@/lib/utils';

interface VirtualReceiptProps {
  receipt: Receipt;
  sessionId: string;
  poll?: boolean;
}

export function VirtualReceipt({ receipt, sessionId, poll = true }: VirtualReceiptProps) {
  const [items, setItems] = useState<ReceiptItem[]>(receipt.items || []);
  const [status, setStatus] = useState(receipt.status);
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setItems(receipt.items || []);
    setStatus(receipt.status);
  }, [receipt]);

  const fetchReceipt = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const response = await fetch(`/api/receipts/${receipt.id}`);
      const data = await response.json();
      if (data.success && isMountedRef.current) {
        setItems(data.data.items || []);
        setStatus(data.data.status);
      }
    } catch (err) {
    } finally {
      isFetchingRef.current = false;
    }
  }, [receipt.id]);

  useEffect(() => {
    if (!poll || status !== 'DRAFT') return;

    const interval = setInterval(fetchReceipt, 3000);
    return () => clearInterval(interval);
  }, [fetchReceipt, poll, status]);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = calculateTax(subtotal);
  const total = subtotal + tax;

  return (
    <ReceiptPanel className="mt-8">
      <div className="p-5 text-center md:p-6">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <span className="material-symbols-outlined text-3xl">receipt_long</span>
        </div>
        <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-100">Virtual Receipt</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Receipt #{receipt.id.slice(-6).toUpperCase()} · Session {sessionId.slice(-6).toUpperCase()}
        </p>
        <div className="mt-4 flex justify-center">
          <Badge variant={status === 'PAID' ? 'success' : status === 'LOCKED' ? 'warning' : 'default'}>
            {status === 'PAID' ? 'Paid' : status === 'LOCKED' ? 'Ready for checkout' : 'Live updating'}
          </Badge>
        </div>
      </div>

      <div className="border-y border-dashed border-slate-200 px-5 py-4 dark:border-slate-800 md:px-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Scanned items</h3>
          <span className="text-sm font-bold text-primary">{items.length} lines</span>
        </div>

        {items.length === 0 ? (
          <EmptyState
            className="mt-4 border-slate-200 bg-slate-50 shadow-none dark:border-slate-800 dark:bg-slate-950"
            icon="barcode_scanner"
            title="No receipt items yet"
            description="Items scanned by the cart will appear here while the session is active."
          />
        ) : (
          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto] gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-950 dark:text-slate-100">{item.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.quantity} x {formatCurrency(item.price)}
                  </p>
                </div>
                <p className="text-sm font-black text-slate-950 dark:text-slate-100">
                  {formatCurrency(item.price * item.quantity)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3 bg-slate-50 p-5 dark:bg-slate-950/50 md:p-6">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Subtotal</span>
          <span className="font-bold text-slate-950 dark:text-slate-100">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Estimated tax</span>
          <span className="font-bold text-slate-950 dark:text-slate-100">{formatCurrency(tax)}</span>
        </div>
        <div className="flex items-end justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
          <span className="text-base font-black text-slate-950 dark:text-slate-100">Total</span>
          <span className="text-3xl font-black text-primary">{formatCurrency(total)}</span>
        </div>
      </div>
    </ReceiptPanel>
  );
}
