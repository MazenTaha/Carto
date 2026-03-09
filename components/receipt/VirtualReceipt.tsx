// Redesigned Virtual Receipt component following Screen 7

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Receipt, ReceiptItem } from '@/types';
import { formatCurrency, calculateTax } from '@/lib/utils';

interface VirtualReceiptProps {
  receipt: Receipt;
  sessionId: string;
}

export function VirtualReceipt({ receipt, sessionId }: VirtualReceiptProps) {
  const [items, setItems] = useState<ReceiptItem[]>(receipt.items || []);
  const [isLocked, setIsLocked] = useState(receipt.status === 'LOCKED');

  const fetchReceipt = useCallback(async () => {
    try {
      const response = await fetch(`/api/receipts/${receipt.id}`);
      const data = await response.json();
      if (data.success) {
        setItems(data.data.items || []);
        setIsLocked(data.data.status === 'LOCKED');
      }
    } catch (err) {}
  }, [receipt.id]);

  useEffect(() => {
    const interval = setInterval(fetchReceipt, 3000);
    return () => clearInterval(interval);
  }, [fetchReceipt]);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = calculateTax(subtotal);
  const total = subtotal + tax;

  return (
    <div className="flex flex-col bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-xl border border-slate-100 dark:border-slate-800 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex p-6 bg-white dark:bg-slate-900 border-b border-slate-50 dark:border-slate-800/50">
        <div className="flex w-full flex-col gap-4 items-center">
          <div className="flex gap-4 flex-col items-center">
            <div className="bg-primary/10 rounded-xl min-h-24 w-24 flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-primary">storefront</span>
            </div>
            <div className="flex flex-col items-center justify-center">
              <p className="text-slate-900 dark:text-slate-100 text-2xl font-bold leading-tight tracking-tight text-center">Carto Supermarket</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal text-center mt-1">
                Receipt #CR-{receipt.id.slice(-6).toUpperCase()} | {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center justify-between px-6 pb-2 pt-6">
          <h3 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-tight">Items Scanned</h3>
          <span className="text-primary text-sm font-semibold">{items.length} Items</span>
        </div>
        <div className="space-y-1 mt-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-4 bg-white dark:bg-slate-900 px-6 min-h-[80px] py-3 justify-between border-b border-slate-50 dark:border-slate-800/50">
              <div className="flex items-center gap-4">
                <div className="bg-slate-100 dark:bg-slate-800 rounded-lg size-14 flex items-center justify-center">
                  <span className="material-symbols-outlined text-slate-400">shopping_bag</span>
                </div>
                <div className="flex flex-col justify-center">
                  <p className="text-slate-900 dark:text-slate-100 text-base font-semibold leading-normal line-clamp-1">{item.name}</p>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal">
                    {item.quantity} x {formatCurrency(item.price)}
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                <p className="text-slate-900 dark:text-slate-100 text-base font-bold leading-normal">
                  {formatCurrency(item.price * item.quantity)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 mt-4 space-y-3 bg-slate-50 dark:bg-slate-900/50 rounded-t-3xl border-t border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
          <span className="text-sm">Subtotal</span>
          <span className="text-base font-medium text-slate-900 dark:text-slate-100">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
          <span className="text-sm">Tax (8%)</span>
          <span className="text-base font-medium text-slate-900 dark:text-slate-100">{formatCurrency(tax)}</span>
        </div>
        <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-between items-center">
          <span className="text-lg font-bold text-slate-900 dark:text-slate-100">Grand Total</span>
          <span className="text-2xl font-bold text-primary">{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}
