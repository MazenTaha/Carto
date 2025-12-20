// Checkout page - payment processing

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Receipt } from '@/types';
import { formatCurrency } from '@/lib/utils';

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('sessionId');
  
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (sessionId) {
      fetchReceipt();
    }
  }, [sessionId]);

  const fetchReceipt = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      const data = await response.json();
      
      if (data.success && data.data.receipt) {
        setReceipt(data.data.receipt);
      } else {
        setError('Receipt not found');
      }
    } catch (err) {
      setError('Failed to load receipt');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!receipt || !sessionId) return;

    setIsProcessing(true);
    setError('');

    try {
      const response = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptId: receipt.id,
          sessionId,
          amount: receipt.total,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payment failed');
      }

      // Redirect to payment page or show success
      if (data.data.paymentUrl) {
        window.location.href = data.data.paymentUrl;
      } else {
        router.push(`/checkout/success?sessionId=${sessionId}`);
      }
    } catch (err: any) {
      setError(err.message || 'Payment processing failed');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <p className="text-center py-8">Loading checkout...</p>
          </Card>
        </main>
      </div>
    );
  }

  if (!receipt || receipt.status !== 'LOCKED') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">
                {error || 'Receipt is not ready for checkout'}
              </p>
              <Button onClick={() => router.push('/dashboard')} variant="primary">
                Go to Dashboard
              </Button>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card title="Checkout">
          <div className="space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
              Please review your receipt before proceeding to payment.
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Order Summary</h3>
              
              {receipt.items && receipt.items.length > 0 ? (
                <div className="space-y-2">
                  {receipt.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between p-3 bg-gray-50 rounded"
                    >
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-gray-500">
                          {formatCurrency(item.price)} × {item.quantity}
                        </div>
                      </div>
                      <div className="font-semibold">
                        {formatCurrency(item.price * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No items in receipt</p>
              )}

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(receipt.subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Tax</span>
                  <span>{formatCurrency(receipt.tax)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total</span>
                  <span>{formatCurrency(receipt.total)}</span>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="flex space-x-4">
              <Button
                variant="outline"
                onClick={() => router.back()}
                disabled={isProcessing}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                variant="primary"
                onClick={handlePayment}
                disabled={isProcessing}
                className="flex-1"
              >
                {isProcessing ? 'Processing...' : 'Proceed to Payment'}
              </Button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}

