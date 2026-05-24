'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { ShoppingCart, Receipt, WifiOff, RefreshCw } from 'lucide-react';
import QRCode from 'react-qr-code';
import { PageContainer } from '@/components/layout/PageContainer';

const deviceFetcher = async ([url, deviceSecret]: [string, string]) => {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${deviceSecret}`,
      // Ensure we don't cache locally
      'Cache-Control': 'no-cache',
    },
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || 'Failed to fetch');
  }
  
  return res.json();
};

const qrFetcher = async ([url, deviceSecret]: [string, string]) => {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${deviceSecret}`,
      'Cache-Control': 'no-cache',
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || 'Failed to fetch QR code');
  }

  return res.json();
};

export default function DeviceSimulatorPage() {
  const [deviceSecret, setDeviceSecret] = useState('dev-device-secret');
  const [cartCode, setCartCode] = useState('CART-001');
  const [isConnected, setIsConnected] = useState(false);

  // Poll every 2.5 seconds when connected
  const { data, error, isLoading } = useSWR(
    isConnected ? [`/api/carts/${cartCode}/active-session`, deviceSecret] : null,
    deviceFetcher,
    {
      refreshInterval: 2500,
      dedupingInterval: 2000,
      revalidateOnFocus: true,
      errorRetryCount: 3,
    }
  );

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceSecret || !cartCode) return;
    setIsConnected(true);
  };

  const handleDisconnect = () => {
    setIsConnected(false);
  };

  const isCartInUse = data?.data?.active;
  const sessionData = data?.data;
  const cartStatus = sessionData?.status;
  const isCartAvailable = cartStatus === 'AVAILABLE';

  // The QR identifies the cart only. The backend creates CartSession after scan,
  // and the cart receives the assigned list/receipt later through polling.
  const { data: qrData, error: qrError, mutate: refreshQr } = useSWR(
    isConnected && isCartAvailable && !isCartInUse
      ? [`/api/carts/${cartCode}/qrcode`, deviceSecret]
      : null,
    qrFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  );

  const qrValue = qrData?.data?.qrValue || '';
  const activePairingCode = qrData?.data?.payload?.pairingCode || 'Loading...';
  const pairingExpiresAt = qrData?.data?.expiresAt || '';
  const formattedExpiry = pairingExpiresAt ? new Date(pairingExpiresAt).toLocaleTimeString() : 'Loading...';

  useEffect(() => {
    if (!isConnected || isCartInUse || !pairingExpiresAt) return;

    const refreshInMs = Math.max(new Date(pairingExpiresAt).getTime() - Date.now() + 250, 1000);
    const timeoutId = window.setTimeout(() => {
      void refreshQr();
    }, refreshInMs);

    return () => window.clearTimeout(timeoutId);
  }, [isConnected, isCartInUse, pairingExpiresAt, refreshQr]);

  return (
    <PageContainer>
      <div className="max-w-4xl mx-auto py-8 px-4 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Controls Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <RefreshCw className="w-5 h-5 text-indigo-500" />
              Hardware Config
            </h2>
            
            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Device Secret
                </label>
                <input
                  type="text"
                  value={deviceSecret}
                  onChange={(e) => setDeviceSecret(e.target.value)}
                  disabled={isConnected}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm disabled:opacity-50"
                  placeholder="Bearer token"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Cart Code
                </label>
                <input
                  type="text"
                  value={cartCode}
                  onChange={(e) => setCartCode(e.target.value)}
                  disabled={isConnected}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm uppercase disabled:opacity-50"
                  placeholder="CART-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Current Pairing Code (Generated by DB)
                </label>
                <input
                  type="text"
                  value={activePairingCode}
                  disabled={true}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm disabled:opacity-50 font-mono"
                  placeholder="..."
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-start gap-2">
                  <WifiOff className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error.message}</span>
                </div>
              )}

              {qrError && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-lg text-sm flex items-start gap-2">
                  <WifiOff className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{qrError.message}</span>
                </div>
              )}

              {isConnected ? (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="w-full py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-xl font-medium transition-colors"
                >
                  Disconnect Simulator
                </button>
              ) : (
                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors"
                >
                  Power On & Connect
                </button>
              )}
            </form>
          </div>

          {/* Connection Status Log */}
          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 shadow-sm font-mono text-xs text-green-400 h-48 overflow-y-auto">
            <p className="text-slate-500 mb-2">Device Log</p>
            {isConnected ? (
              <>
                <p>&gt; Device initialized</p>
                <p>&gt; Authenticating with {cartCode}...</p>
                {isLoading && <p>&gt; Polling active session...</p>}
                {data && <p>&gt; Received payload [200 OK]</p>}
                {qrData && !isCartInUse && <p>&gt; Generated authenticated pairing QR [200 OK]</p>}
                {error && <p className="text-red-400">&gt; Connection failed: {error.message}</p>}
                {qrError && <p className="text-amber-300">&gt; QR generation failed: {qrError.message}</p>}
                {isCartInUse && <p className="text-blue-400">&gt; Session ACTIVE. Disabling QR.</p>}
              </>
            ) : (
              <p className="text-slate-500">&gt; Device offline</p>
            )}
          </div>
        </div>

        {/* The Cart "Screen" */}
        <div className="lg:col-span-2">
          <div className="aspect-[4/3] bg-black rounded-[2rem] border-[12px] border-slate-800 p-8 shadow-2xl relative overflow-hidden flex flex-col">
            
            {/* Top Bar */}
            <div className="flex items-center justify-between text-slate-400 mb-8 z-10">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                <span className="font-bold tracking-widest">{cartCode}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-sm font-medium">{isConnected ? 'ONLINE' : 'OFFLINE'}</span>
              </div>
            </div>

            {/* Screen Content */}
            <div className="flex-1 flex flex-col items-center justify-center z-10 text-center">
              {!isConnected ? (
                <div className="text-slate-500 flex flex-col items-center">
                  <WifiOff className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-lg">No Power</p>
                </div>
              ) : isLoading && !data ? (
                <div className="text-slate-400 flex flex-col items-center">
                  <RefreshCw className="w-12 h-12 mb-4 animate-spin opacity-50" />
                  <p>Booting OS...</p>
                </div>
              ) : isCartAvailable && !isCartInUse ? (
                <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
                  <div className="bg-white p-6 rounded-3xl mb-6 shadow-2xl flex items-center justify-center min-h-[240px] min-w-[240px]">
                    {qrValue ? (
                      <QRCode value={qrValue} size={192} />
                    ) : (
                      <RefreshCw className="w-8 h-8 text-slate-300 animate-spin" />
                    )}
                  </div>
                  <h1 className="text-3xl font-bold text-white mb-2">Scan to Shop</h1>
                  <p className="text-slate-400 text-lg">Use the Carto app to scan this QR code.</p>
                  <div className="mt-8 grid grid-cols-1 gap-2 rounded-2xl bg-slate-800/50 px-6 py-4 text-left font-mono text-sm text-slate-300">
                    <div>Cart Code: {cartCode}</div>
                    <div>Pairing Code: {activePairingCode}</div>
                    <div>Expires: {formattedExpiry}</div>
                  </div>
                </div>
              ) : !isCartInUse ? (
                <div className="text-slate-400 flex flex-col items-center">
                  <RefreshCw className="w-12 h-12 mb-4 animate-spin opacity-50" />
                  <p>Waiting for available cart status...</p>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-start text-left animate-in fade-in slide-in-from-bottom-8 duration-500">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center">
                      <Receipt className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-white">Active Session</h1>
                      <p className="text-indigo-300">Welcome to Carto</p>
                    </div>
                  </div>

                  <div className="w-full grid grid-cols-2 gap-6 flex-1 min-h-0">
                    <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 overflow-y-auto">
                      <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider">Shopping List</h3>
                      {sessionData.list?.items?.length === 0 ? (
                        <p className="text-slate-500 italic">List is empty</p>
                      ) : (
                        <ul className="space-y-3">
                          {sessionData.list?.items?.map((item: any) => (
                            <li key={item.id} className={`flex justify-between items-center ${item.isCollected ? 'opacity-50 line-through' : ''}`}>
                              <span className="text-slate-200">{item.name}</span>
                              <span className="text-slate-500">x{item.quantity}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 overflow-y-auto flex flex-col">
                      <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider">Current Receipt</h3>
                      {sessionData.receipt?.items?.length === 0 ? (
                        <p className="text-slate-500 italic flex-1">Scan items to add them</p>
                      ) : (
                        <ul className="space-y-3 flex-1">
                          {sessionData.receipt?.items?.map((item: any) => (
                            <li key={item.id} className="flex justify-between items-center text-sm">
                              <span className="text-slate-300">{item.name} <span className="text-slate-600">x{item.quantity}</span></span>
                              <span className="text-slate-300 font-mono">${(item.price * item.quantity).toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      
                      <div className="mt-auto pt-4 border-t border-slate-800">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Total</span>
                          <span className="text-2xl font-bold text-white font-mono">${sessionData.receipt?.total?.toFixed(2) || '0.00'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Screen Glare Effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.02] to-white/[0.08] pointer-events-none" />
          </div>
        </div>

      </div>
    </PageContainer>
  );
}
