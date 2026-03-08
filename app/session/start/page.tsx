// Start shopping session page - QR code display for cart linking

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { QRCodeSVG } from 'qrcode.react';

export default function StartSessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listId = searchParams.get('listId');
  
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [cartCode, setCartCode] = useState<string>('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (listId) {
      fetchQRCode();
    }
  }, [listId]);

  const fetchQRCode = async () => {
    try {
      const response = await fetch(`/api/cart/qrcode?listId=${listId}`);
      const data = await response.json();
      
      if (data.success) {
        // Use the raw QR data for the QRCodeSVG component
        setQrCodeData(data.data.qrData || JSON.stringify(data.data));
      } else {
        setError(data.error || 'Failed to generate QR code');
      }
    } catch (err) {
      setError('Failed to generate QR code');
    }
  };

  const handleManualLink = async () => {
    if (!cartCode.trim()) {
      setError('Please enter a cart code');
      return;
    }

    if (!listId) {
      setError('List ID is missing');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/cart/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartCode: cartCode.trim(), listId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to link cart');
      }

      router.push(`/session?sessionId=${data.data.id}`);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!listId) {
    return (
      <div className="min-h-screen bg-slate-950 flex">
        <Sidebar />
        <main className="flex-1 ml-64 min-h-screen flex items-center justify-center p-8">
          <div className="bg-gray-800/40 backdrop-blur-sm rounded-[2.5rem] border border-gray-700/50 shadow-2xl p-12 text-center max-w-md w-full">
            <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-red-500/20">
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">No list selected</h2>
            <p className="text-gray-400 mb-8">Please select a shopping list before starting a session.</p>
            <Button onClick={() => router.push('/lists')} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-bold shadow-xl shadow-blue-600/20">
              VIEW MY LISTS
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
          {/* Left Side: QR Code */}
          <div className="flex-1 p-10 flex flex-col items-center justify-center bg-white">
            <div className="mb-6 text-center">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Scan to Link</h3>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Point your cart camera here</p>
            </div>

            {qrCodeData ? (
              <div className="p-4 bg-white rounded-3xl border-4 border-slate-100 shadow-inner">
                <QRCodeSVG value={qrCodeData} size={220} level="H" includeMargin={false} />
              </div>
            ) : (
              <div className="w-[220px] h-[220px] bg-slate-50 rounded-3xl animate-pulse flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
              </div>
            )}

            <div className="mt-8 flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Waiting for cart...</span>
            </div>
          </div>

          {/* Right Side: Manual Link */}
          <div className="w-full md:w-80 p-10 bg-gray-800/40 border-l border-gray-700/50 flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-bold text-white mb-6 tracking-tight">Manual Entry</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Cart Code</label>
                  <input
                    type="text"
                    value={cartCode}
                    onChange={(e) => setCartCode(e.target.value)}
                    placeholder="e.g. CART-001"
                    className="w-full bg-gray-900/50 border border-gray-700 text-white rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono text-sm placeholder:text-gray-700"
                  />
                </div>

                <button
                  onClick={handleManualLink}
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  {isLoading ? 'LINKING...' : 'LINK CART'}
                </button>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-[10px] font-bold uppercase tracking-wider animate-in fade-in slide-in-from-top-2">
                  {error}
                </div>
              )}

              <button
                onClick={() => router.back()}
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

