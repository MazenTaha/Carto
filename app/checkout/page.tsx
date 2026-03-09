// Redesigned Checkout page following Screen 8

'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { Receipt } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('sessionId');
  
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'saved' | 'new'>('saved');

  const fetchReceipt = useCallback(async () => {
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
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) {
      fetchReceipt();
    }
  }, [sessionId, fetchReceipt]);

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
      if (!response.ok) throw new Error(data.error || 'Payment failed');

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
      <PageContainer className="flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-slate-400 font-bold uppercase text-sm">Initializing checkout...</p>
        </div>
      </PageContainer>
    );
  }

  if (!receipt) {
    return (
      <PageContainer className="flex items-center justify-center p-8 text-center">
         <h2 className="text-2xl font-bold mb-4">Checkout not ready</h2>
         <button onClick={() => router.push('/dashboard')} className="bg-primary text-white px-6 py-3 rounded-xl font-bold">
            Back to Dashboard
         </button>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="bg-white dark:bg-slate-900">
      <Header title="Checkout" showBack={true} />

      <div className="flex-1 overflow-y-auto pb-10">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Order Summary</h2>
          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">
            <div className="flex justify-between items-center">
              <p className="text-slate-500 dark:text-slate-400 text-sm">Shopping Session Items</p>
              <p className="font-medium">{formatCurrency(receipt.subtotal)}</p>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-slate-500 dark:text-slate-400 text-sm">Platform Fee</p>
              <p className="font-medium">$0.00</p>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-slate-500 dark:text-slate-400 text-sm">Estimated Tax</p>
              <p className="font-medium">{formatCurrency(receipt.tax)}</p>
            </div>
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <p className="text-base font-bold">Total Amount</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(receipt.total)}</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Payment Method</h2>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button className="flex items-center justify-center gap-2 py-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
              <div className="w-6 h-6 bg-black rounded-md flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">Pay</span>
              </div>
              <span className="text-sm font-semibold">Apple Pay</span>
            </button>
            <button className="flex items-center justify-center gap-2 py-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
              </svg>
              <span className="text-sm font-semibold">Google Pay</span>
            </button>
          </div>

          <div className="relative flex py-5 items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
            <span className="flex-shrink mx-4 text-slate-400 text-xs uppercase tracking-widest font-medium">Or pay with card</span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
          </div>

          <div className="mb-6">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Saved Card</label>
            <div className="relative group cursor-pointer" onClick={() => setPaymentMethod('saved')}>
              <div className={cn(
                "flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition-all",
                paymentMethod === 'saved' ? "border-primary bg-primary/5 dark:bg-primary/10" : "border-slate-200 dark:border-slate-700"
              )}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-8 bg-slate-200 dark:bg-slate-700 rounded flex items-center justify-center overflow-hidden">
                    <span className="text-[10px] font-bold">VISA</span>
                  </div>
                  <div>
                    <p className="font-bold text-sm">Visa ending in 4242</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Expires 12/26</p>
                  </div>
                </div>
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                  paymentMethod === 'saved' ? "border-primary" : "border-slate-300 dark:border-slate-600"
                )}>
                  {paymentMethod === 'saved' && <div className="w-2.5 h-2.5 bg-primary rounded-full"></div>}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="relative group cursor-pointer" onClick={() => setPaymentMethod('new')}>
              <div className={cn(
                "flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-all",
                paymentMethod === 'new' ? "border-primary bg-primary/5" : "border-slate-200 dark:border-slate-700"
              )}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-8 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center">
                    <span className="material-symbols-outlined text-slate-400">add_card</span>
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-600 dark:text-slate-300">Add new payment method</p>
                  </div>
                </div>
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                  paymentMethod === 'new' ? "border-primary" : "border-slate-300 dark:border-slate-600"
                )}>
                  {paymentMethod === 'new' && <div className="w-2.5 h-2.5 bg-primary rounded-full"></div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 mt-auto shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-center gap-2 mb-4 text-slate-400">
          <span className="material-symbols-outlined text-sm">lock</span>
          <span className="text-xs font-medium">Secure SSL Encrypted Payment</span>
        </div>
        <button
          onClick={handlePayment}
          disabled={isProcessing}
          className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isProcessing ? "Processing..." : `Confirm and Pay ${formatCurrency(receipt.total)}`}
        </button>
      </div>
    </PageContainer>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <PageContainer className="flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-slate-400 font-bold uppercase text-sm">Loading checkout...</p>
        </div>
      </PageContainer>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
