// Checkout page - payment processing

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
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
      <div className="min-h-screen bg-slate-950 flex">
        <Sidebar />
        <main className="flex-1 ml-64 min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-gray-400 font-bold tracking-widest uppercase text-sm">Initializing checkout...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!receipt || receipt.status !== 'LOCKED') {
    return (
      <div className="min-h-screen bg-slate-950 flex">
        <Sidebar />
        <main className="flex-1 ml-64 min-h-screen flex items-center justify-center p-8">
          <div className="bg-gray-800/40 backdrop-blur-sm rounded-[2.5rem] border border-gray-700/50 shadow-2xl p-12 text-center max-w-md w-full">
            <div className="w-24 h-24 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-red-500/20">
              <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Checkout not ready</h2>
            <p className="text-gray-400 mb-8 text-lg">{error || 'Your receipt is not ready for checkout. Please return to your active session.'}</p>
            <Button onClick={() => router.push('/dashboard')} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-bold shadow-xl shadow-blue-600/20">
              BACK TO DASHBOARD
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen flex items-center justify-center p-8">
        <div className="bg-gray-800/40 backdrop-blur-sm rounded-[2.5rem] border border-gray-700/50 shadow-2xl overflow-hidden max-w-2xl w-full flex flex-col md:flex-row">
          {/* Left Side: Summary */}
          <div className="flex-1 p-10 bg-black/20">
            <h1 className="text-3xl font-bold text-white tracking-tight mb-8">Checkout</h1>

            <div className="space-y-6">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Order Summary</div>
              
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {receipt.items && receipt.items.length > 0 ? (
                  receipt.items.map((item) => (
                    <div key={item.id} className="flex justify-between group">
                      <div className="flex-1">
                        <div className="font-bold text-gray-200 group-hover:text-white transition-colors">{item.name}</div>
                        <div className="text-xs text-gray-500 font-mono">
                          {formatCurrency(item.price)} × {item.quantity}
                        </div>
                      </div>
                      <div className="text-gray-200 font-bold font-mono">
                        {formatCurrency(item.price * item.quantity)}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 italic">No items found</p>
                )}
              </div>

              <div className="h-px w-full bg-gray-700/50" />

              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatCurrency(receipt.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Estimated Tax</span>
                  <span className="font-mono">{formatCurrency(receipt.tax)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Payment Action */}
          <div className="w-full md:w-80 p-10 bg-gray-800/40 border-l border-gray-700/50 flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-bold text-blue-500 uppercase tracking-[0.2em] mb-2">Total Amount</div>
              <div className="text-5xl font-black text-white font-mono mb-8 tracking-tighter">
                {formatCurrency(receipt.total)}
              </div>

              <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-4 mb-8">
                <p className="text-xs text-blue-300 font-medium leading-relaxed">
                  Proceed to our secure payment gateway to complete your purchase.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-[10px] font-bold uppercase tracking-wider">
                  {error}
                </div>
              )}

              <button
                onClick={handlePayment}
                disabled={isProcessing}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-5 rounded-2xl shadow-xl shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? (
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <>
                    PAY NOW
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </>
                )}
              </button>

              <button
                onClick={() => router.back()}
                disabled={isProcessing}
                className="w-full py-4 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-bold rounded-2xl transition-all text-xs"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

