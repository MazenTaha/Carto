// Active shopping session page - real-time tracking

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { VirtualReceipt } from '@/components/receipt/VirtualReceipt';
import { useSessionStore } from '@/store/session-store';
import { calculateProgress } from '@/lib/utils';

export default function SessionPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('sessionId');
  
  const { session, receipt, progress, isConnected, setSession, setReceipt, updateProgress, setConnected } = useSessionStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (sessionId) {
      fetchSession();
      // Poll for updates every 3 seconds
      const interval = setInterval(fetchSession, 3000);
      return () => clearInterval(interval);
    } else {
      // Try to find active session
      fetchActiveSession();
      const interval = setInterval(fetchActiveSession, 3000);
      return () => clearInterval(interval);
    }
  }, [sessionId]);

  const fetchSession = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      const data = await response.json();
      
      if (data.success) {
        setSession(data.data.session);
        setReceipt(data.data.receipt);
        setConnected(data.data.session.status === 'ACTIVE');
        
        // Calculate progress
        if (data.data.session.shoppingList?.items) {
          const items = data.data.session.shoppingList.items;
          const total = items.length;
          const collected = items.filter((item: any) => item.isCollected).length;
          updateProgress(total, collected);
        }
      }
    } catch (err) {
      console.error('Error fetching session:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActiveSession = async () => {
    try {
      const response = await fetch('/api/sessions/active');
      const data = await response.json();
      
      if (data.success && data.data) {
        setSession(data.data.session);
        setReceipt(data.data.receipt);
        setConnected(data.data.session.status === 'ACTIVE');
        
        if (data.data.session.shoppingList?.items) {
          const items = data.data.session.shoppingList.items;
          const total = items.length;
          const collected = items.filter((item: any) => item.isCollected).length;
          updateProgress(total, collected);
        }
      }
    } catch (err) {
      console.error('Error fetching active session:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinishShopping = async () => {
    if (!session) return;

    try {
      const response = await fetch(`/api/sessions/${session.id}/finish`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/checkout?sessionId=${session.id}`);
      }
    } catch (err) {
      console.error('Error finishing session:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex">
        <Sidebar />
        <main className="flex-1 ml-64 min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-gray-400 font-bold tracking-widest uppercase text-sm">Loading session...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex">
        <Sidebar />
        <main className="flex-1 ml-64 min-h-screen flex items-center justify-center p-8">
          <div className="bg-gray-800/40 backdrop-blur-sm rounded-[2.5rem] border border-gray-700/50 shadow-2xl p-12 text-center max-w-md w-full">
            <div className="w-24 h-24 bg-gray-700/50 rounded-3xl flex items-center justify-center mx-auto mb-8">
              <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">No active session</h2>
            <p className="text-gray-400 mb-8 text-lg">You don't have an active shopping session. Connect to a cart to start!</p>
            <Button onClick={() => router.push('/lists')} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-bold shadow-xl shadow-blue-600/20">
              START SHOPPING
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const progressData = calculateProgress(progress.total, progress.collected);

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen flex flex-col p-8">
        <div className="mb-10 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-bold text-white tracking-tight">Shopping Session</h1>
            <div className="mt-2 flex items-center gap-4">
              <span className="text-xs font-mono text-gray-500 bg-black/40 px-3 py-1 rounded-full border border-gray-700/50 uppercase tracking-widest">
                Cart: {session.cartId}
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                <span className={`w-1.5 h-1.5 rounded-full mr-2 ${session.status === 'ACTIVE' ? 'bg-blue-400 animate-pulse' : 'bg-gray-500'}`} />
                {session.status}
              </span>
            </div>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border ${isConnected ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-xs font-bold uppercase tracking-widest">
              {isConnected ? 'Sync Connected' : 'Sync Offline'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-gray-800/40 backdrop-blur-sm rounded-[2rem] border border-gray-700/50 shadow-2xl p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white uppercase tracking-wider">Shopping Progress</h3>
                <span className="font-mono text-2xl text-blue-400 font-bold">
                  {progressData.percentage}%
                </span>
              </div>

              <div className="space-y-6">
                <div className="w-full bg-gray-900/50 rounded-full h-3 overflow-hidden border border-gray-700/30">
                  <div
                    className="bg-gradient-to-r from-blue-600 to-blue-400 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                    style={{ width: `${progressData.percentage}%` }}
                  />
                </div>

                <div className="flex justify-between items-center bg-black/20 p-4 rounded-2xl border border-white/5">
                  <div className="text-center flex-1 border-r border-white/5">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Items Collected</div>
                    <div className="text-2xl font-bold text-white">{progressData.collected}</div>
                  </div>
                  <div className="text-center flex-1">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total in List</div>
                    <div className="text-2xl font-bold text-gray-400">{progressData.total}</div>
                  </div>
                </div>
              </div>
            </div>

            {receipt && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <VirtualReceipt receipt={receipt} sessionId={session.id} />
              </div>
            )}
          </div>

          <div className="space-y-8">
            <div className="bg-gray-800/40 backdrop-blur-sm rounded-[2rem] border border-gray-700/50 shadow-2xl p-8 sticky top-8">
              <h3 className="text-xl font-bold text-white mb-8 uppercase tracking-wider">Session Actions</h3>
              <div className="space-y-4">
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-5 rounded-2xl shadow-xl shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
                  onClick={handleFinishShopping}
                  disabled={session.status !== 'ACTIVE' || progressData.total === 0}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  FINISH & CHECKOUT
                </Button>
                <Button
                  className="w-full bg-gray-700/50 hover:bg-gray-700 text-gray-300 font-bold py-5 rounded-2xl border border-gray-600/50 transition-all"
                  onClick={() => router.push('/lists')}
                >
                  EDIT SHOPPING LIST
                </Button>
                <div className="h-px w-full bg-gray-700/50 my-4" />
                <p className="text-[10px] text-gray-500 text-center font-bold uppercase tracking-widest leading-relaxed">
                  Your receipt will be generated automatically as you scan items with your cart.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

