// Active shopping session page - real-time tracking

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
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
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <p className="text-center py-8">Loading session...</p>
          </Card>
        </main>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No active shopping session found.</p>
              <Button onClick={() => router.push('/lists')} variant="primary">
                Start Shopping
              </Button>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  const progressData = calculateProgress(progress.total, progress.collected);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Shopping Session</h1>
          <p className="text-sm text-gray-600 mt-1">
            Cart ID: {session.cartId} • Status: {session.status}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card title="Shopping Progress">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-semibold">
                    {progressData.collected} / {progressData.total} items
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-blue-600 h-4 rounded-full transition-all"
                    style={{ width: `${progressData.percentage}%` }}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      isConnected ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <span className="text-sm text-gray-600">
                    {isConnected ? 'Cart Connected' : 'Cart Disconnected'}
                  </span>
                </div>
              </div>
            </Card>

            {receipt && <VirtualReceipt receipt={receipt} sessionId={session.id} />}
          </div>

          <div>
            <Card title="Actions">
              <div className="space-y-3">
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={handleFinishShopping}
                  disabled={session.status !== 'ACTIVE'}
                >
                  Finish Shopping
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/lists')}
                >
                  View Lists
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

