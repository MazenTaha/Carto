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
    <Card title="Virtual Receipt" className="mt-6">
      {isLocked && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 rounded mb-4">
          Receipt is locked for checkout
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No items scanned yet.</p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded border"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{item.name}</div>
                  <div className="text-sm text-gray-500">
                    {formatCurrency(item.price)} × {item.quantity}
                    {item.category && ` • ${item.category}`}
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <div className="font-semibold">
                      {formatCurrency(item.price * item.quantity)}
                    </div>
                  </div>
                  {!isLocked && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                        className="w-8 h-8 rounded border border-gray-300 hover:bg-gray-100"
                        disabled={item.quantity <= 1}
                      >
                        -
                      </button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                        className="w-8 h-8 rounded border border-gray-300 hover:bg-gray-100"
                      >
                        +
                      </button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleRemoveItem(item.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Tax</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

