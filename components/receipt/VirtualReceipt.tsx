// Virtual receipt component - displays items in real-time

'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Receipt, ReceiptItem } from '@/types';
import { formatCurrency, calculateTax } from '@/lib/utils';

interface VirtualReceiptProps {
  receipt: Receipt;
  sessionId: string;
}

export function VirtualReceipt({ receipt, sessionId }: VirtualReceiptProps) {
  const [items, setItems] = useState<ReceiptItem[]>(receipt.items || []);
  const [isLocked, setIsLocked] = useState(receipt.status === 'LOCKED');

  useEffect(() => {
    // Poll for receipt updates
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/receipts/${receipt.id}`);
        const data = await response.json();
        
        if (data.success) {
          setItems(data.data.items || []);
          setIsLocked(data.data.status === 'LOCKED');
        }
      } catch (err) {
        console.error('Error fetching receipt:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [receipt.id]);

  const handleRemoveItem = async (itemId: string) => {
    if (isLocked) return;

    try {
      const response = await fetch(`/api/receipts/${receipt.id}/items/${itemId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setItems(items.filter((item) => item.id !== itemId));
      }
    } catch (err) {
      console.error('Error removing item:', err);
    }
  };

  const handleUpdateQuantity = async (itemId: string, quantity: number) => {
    if (isLocked || quantity < 1) return;

    try {
      const response = await fetch(`/api/receipts/${receipt.id}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      });

      if (response.ok) {
        const data = await response.json();
        setItems(
          items.map((item) =>
            item.id === itemId ? { ...item, quantity: data.data.quantity } : item
          )
        );
      }
    } catch (err) {
      console.error('Error updating quantity:', err);
    }
  };

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = calculateTax(subtotal);
  const total = subtotal + tax;

  return (
    <div className="bg-gray-800/40 backdrop-blur-sm rounded-[2rem] border border-gray-700/50 shadow-2xl overflow-hidden mt-8">
      <div className="px-8 py-6 border-b border-gray-700/50 flex justify-between items-center">
        <h3 className="text-xl font-bold text-white uppercase tracking-wider">Virtual Receipt</h3>
        {isLocked && (
          <span className="px-3 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full text-[10px] font-bold uppercase tracking-widest">
            Locked for Checkout
          </span>
        )}
      </div>

      <div className="p-8">
        {items.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-16 h-16 bg-gray-700/30 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-700/50">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 022 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">No items scanned yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-transparent hover:border-gray-700/50 transition-all"
                >
                  <div className="flex-1">
                    <div className="font-bold text-gray-200 group-hover:text-white transition-colors">
                      {item.name}
                    </div>
                    <div className="text-xs text-gray-500 font-mono mt-1">
                      {formatCurrency(item.price)} × {item.quantity}
                      {item.category && (
                        <span className="ml-2 px-2 py-0.5 bg-black/30 rounded text-[10px] uppercase tracking-tighter">
                          {item.category}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right font-bold text-white font-mono">
                      {formatCurrency(item.price * item.quantity)}
                    </div>

                    {!isLocked && (
                      <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-xl border border-gray-700/50">
                        <button
                          onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-all disabled:opacity-30"
                          disabled={item.quantity <= 1}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                        </button>
                        <span className="w-6 text-center font-bold text-white text-sm font-mono">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                        <div className="w-px h-4 bg-gray-700/50 mx-1" />
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-gray-700/50 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 font-bold uppercase tracking-widest">Subtotal</span>
                <span className="text-gray-300 font-mono font-bold">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 font-bold uppercase tracking-widest">Estimated Tax (8.5%)</span>
                <span className="text-gray-300 font-mono font-bold">{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-gray-700/50">
                <span className="text-white font-black uppercase tracking-[0.2em] text-lg">Total Amount</span>
                <span className="text-3xl font-black text-white font-mono tracking-tighter">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

