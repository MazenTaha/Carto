'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { RefreshCw, Receipt, ShoppingCart, Wifi, WifiOff } from 'lucide-react';
import QRCode from 'react-qr-code';
import { PageContainer } from '@/components/layout/PageContainer';

const STORAGE_KEY = 'carto_device_simulator_config';

type DeviceResponse =
  | {
      status: 'waiting';
      active: false;
      cartCode: string;
      cartStatus: string;
      cart: {
        cartCode: string;
        status: string;
      };
    }
  | {
      status: 'active';
      active: true;
      cartCode: string;
      cartStatus: string;
      cartSessionId: string;
      receiptId: string | null;
      shoppingList: {
        id: string;
        name: string;
        items: Array<{
          id: string;
          name: string;
          quantity: number;
          price: number;
          category: string | null;
          checked: boolean;
        }>;
      };
      cart: {
        cartCode: string;
        status: string;
      };
      session: {
        id: string;
        status: string;
        startedAt: string;
        endedAt: string | null;
      };
      list: {
        id: string;
        name: string;
        items: Array<{
          id: string;
          name: string;
          quantity: number;
          price: number;
          category: string | null;
          isCollected: boolean;
        }>;
      };
      receipt: {
        id: string;
        status: string;
        subtotal: number;
        tax: number;
        total: number;
        items: Array<{
          id: string;
          name: string;
          quantity: number;
          price: number;
          category: string | null;
        }>;
      } | null;
    };

type QrResponse = {
  payload: {
    type: 'cart_pairing';
    cartCode: string;
    pairingCode: string;
  };
  qrValue: string;
  expiresAt: string;
};

type DisconnectResponse = {
  cartCode: string;
  cartStatus: 'AVAILABLE';
  activeSessionReleased: boolean;
};

function getApiErrorMessage(data: any, fallback: string) {
  if (data?.error?.message) return data.error.message;
  if (typeof data?.error === 'string') return data.error;
  return fallback;
}

const jsonFetcher = async ([url, deviceSecret]: [string, string]) => {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${deviceSecret}`,
      'Cache-Control': 'no-cache',
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.success === false) {
    throw new Error(getApiErrorMessage(data, 'Request failed.'));
  }

  return data.data;
};

export default function DeviceSimulatorPage() {
  const [deviceSecret, setDeviceSecret] = useState('dev-device-secret');
  const [cartCode, setCartCode] = useState('CART-001');
  const [isConnected, setIsConnected] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [lastPollAt, setLastPollAt] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [eventLogs, setEventLogs] = useState<string[]>([]);

  const appendLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setEventLogs((current) => [`[${timestamp}] ${message}`, ...current].slice(0, 10));
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { cartCode?: string; deviceSecret?: string };
        if (parsed.cartCode) setCartCode(parsed.cartCode);
        if (parsed.deviceSecret) setDeviceSecret(parsed.deviceSecret);
      }
    } catch {}

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        cartCode,
        deviceSecret,
      })
    );
  }, [hydrated, cartCode, deviceSecret]);

  const trimmedCartCode = cartCode.trim().toUpperCase();
  const trimmedDeviceSecret = deviceSecret.trim();
  const activeSessionKey = useMemo(
    () =>
      isConnected && trimmedCartCode && trimmedDeviceSecret
        ? [`/api/carts/${encodeURIComponent(trimmedCartCode)}/active-session`, trimmedDeviceSecret] as [string, string]
        : null,
    [isConnected, trimmedCartCode, trimmedDeviceSecret]
  );

  const {
    data: deviceData,
    error: deviceError,
    isLoading: isDeviceLoading,
    mutate: refreshDevice,
  } = useSWR<DeviceResponse>(activeSessionKey, jsonFetcher, {
    refreshInterval: isConnected && !isDisconnecting ? 2000 : 0,
    dedupingInterval: 750,
    revalidateOnFocus: true,
    revalidateIfStale: true,
    onSuccess: () => setLastPollAt(new Date().toISOString()),
  });

  const cartStatus = deviceData?.cartStatus ?? deviceData?.cart?.status ?? 'OFFLINE';
  const isActive = deviceData?.active === true;

  const qrKey = useMemo(
    () =>
      isConnected && trimmedCartCode && trimmedDeviceSecret && !isActive && cartStatus === 'AVAILABLE'
        ? [`/api/carts/${encodeURIComponent(trimmedCartCode)}/qrcode`, trimmedDeviceSecret] as [string, string]
        : null,
    [isConnected, trimmedCartCode, trimmedDeviceSecret, isActive, cartStatus]
  );

  const {
    data: qrData,
    error: qrError,
    isLoading: isQrLoading,
    mutate: refreshQr,
  } = useSWR<QrResponse>(qrKey, jsonFetcher, {
    dedupingInterval: 1000,
    revalidateOnFocus: false,
  });

  useEffect(() => {
    if (!isConnected || isActive || !qrData?.expiresAt) return;

    const refreshInMs = Math.max(new Date(qrData.expiresAt).getTime() - Date.now() + 250, 1000);
    const timeoutId = window.setTimeout(() => {
      void refreshQr();
    }, refreshInMs);

    return () => window.clearTimeout(timeoutId);
  }, [isConnected, isActive, qrData?.expiresAt, refreshQr]);

  const handleConnect = (event: React.FormEvent) => {
    event.preventDefault();
    if (!trimmedCartCode || !trimmedDeviceSecret) return;
    setIsConnected(true);
    appendLog(`Connected simulator to cart: ${trimmedCartCode}`);
  };

  const handleDisconnect = useCallback(async () => {
    if (!isConnected || !trimmedCartCode || !trimmedDeviceSecret || isDisconnecting) return;

    setIsDisconnecting(true);
    appendLog(`Disconnecting cart: ${trimmedCartCode}`);

    try {
      const response = await fetch(`/api/carts/${encodeURIComponent(trimmedCartCode)}/disconnect`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${trimmedDeviceSecret}`,
        },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.success === false) {
        throw new Error(getApiErrorMessage(data, 'Could not disconnect this cart.'));
      }

      const disconnectData = data.data as DisconnectResponse;
      const waitingState: DeviceResponse = {
        status: 'waiting',
        active: false,
        cartCode: disconnectData.cartCode,
        cartStatus: disconnectData.cartStatus,
        cart: {
          cartCode: disconnectData.cartCode,
          status: disconnectData.cartStatus,
        },
      };

      const freshQr = await jsonFetcher([
        `/api/carts/${encodeURIComponent(trimmedCartCode)}/qrcode`,
        trimmedDeviceSecret,
      ]) as QrResponse;

      await refreshDevice(waitingState, { revalidate: false });
      await refreshQr(freshQr, { revalidate: false });
      setLastPollAt(new Date().toISOString());
      appendLog(`Disconnected cart: ${disconnectData.cartCode}`);
      appendLog('Cart released and QR refreshed');
    } catch (error: any) {
      appendLog(`Disconnect failed: ${error.message || 'Safe error unavailable.'}`);
      window.alert(error.message || 'Could not disconnect this cart.');
    } finally {
      setIsDisconnecting(false);
      if (isConnected) {
        void refreshDevice();
      }
    }
  }, [
    isConnected,
    trimmedCartCode,
    trimmedDeviceSecret,
    isDisconnecting,
    appendLog,
    refreshDevice,
    refreshQr,
  ]);

  const handleResetCart = async () => {
    if (!trimmedCartCode || isResetting) return;

    setIsResetting(true);

    try {
      const response = await fetch(`/api/carts/${encodeURIComponent(trimmedCartCode)}/reset`, {
        method: 'POST',
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.success === false) {
        throw new Error(getApiErrorMessage(data, 'Could not reset this cart.'));
      }

      setLastPollAt(null);
      await refreshDevice();
      await refreshQr();
    } catch (error: any) {
      window.alert(error.message || 'Could not reset this cart.');
    } finally {
      setIsResetting(false);
    }
  };

  const connectionLabel = !isConnected
    ? 'OFFLINE'
    : deviceError
      ? 'AUTH ERROR'
      : 'ONLINE';

  const pollStatus = !isConnected
    ? 'Simulator disconnected'
    : deviceError
      ? deviceError.message
      : isDeviceLoading && !deviceData
        ? 'Booting and polling backend...'
        : lastPollAt
          ? `Last poll ${new Date(lastPollAt).toLocaleTimeString()}`
          : 'Waiting for first poll';

  return (
    <PageContainer>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
              <RefreshCw className="h-5 w-5 text-indigo-500" />
              Device Config
            </h2>

            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Cart Code
                </label>
                <input
                  type="text"
                  value={cartCode}
                  onChange={(event) => setCartCode(event.target.value.toUpperCase())}
                  disabled={isConnected}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm uppercase disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950"
                  placeholder="CART-001"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Device Secret
                </label>
                <input
                  type="text"
                  value={deviceSecret}
                  onChange={(event) => setDeviceSecret(event.target.value)}
                  disabled={isConnected}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950"
                  placeholder="dev-device-secret"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-950">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Pairing code</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {qrData?.payload?.pairingCode ?? 'Waiting...'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Expires</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {qrData?.expiresAt ? new Date(qrData.expiresAt).toLocaleTimeString() : 'Waiting...'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Cart status</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{cartStatus}</span>
                </div>
              </div>

              {deviceError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
                  {deviceError.message}
                </div>
              )}

              {qrError && (
                <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                  {qrError.message}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {isConnected ? (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                    className="col-span-2 rounded-xl bg-slate-200 py-2.5 font-medium text-slate-900 transition-colors hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                  >
                    {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="col-span-2 rounded-xl bg-indigo-600 py-2.5 font-medium text-white transition-colors hover:bg-indigo-700"
                  >
                    Power On and Connect
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void refreshDevice()}
                  disabled={!isConnected || isDisconnecting}
                  className="rounded-xl border border-slate-200 py-2 text-sm font-medium text-slate-700 disabled:opacity-50 dark:border-slate-800 dark:text-slate-200"
                >
                  Poll now
                </button>
                <button
                  type="button"
                  onClick={() => void refreshQr()}
                  disabled={!isConnected || isDisconnecting || isActive || cartStatus !== 'AVAILABLE'}
                  className="rounded-xl border border-slate-200 py-2 text-sm font-medium text-slate-700 disabled:opacity-50 dark:border-slate-800 dark:text-slate-200"
                >
                  Refresh QR
                </button>
                {process.env.NODE_ENV !== 'production' && (
                  <button
                    type="button"
                    onClick={() => void handleResetCart()}
                    disabled={!isConnected || isResetting || isDisconnecting}
                    className="col-span-2 rounded-xl border border-amber-300 bg-amber-50 py-2.5 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                  >
                    {isResetting ? 'Resetting Cart...' : 'Reset Cart'}
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="h-52 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-green-400 shadow-sm">
            <p className="mb-2 text-slate-500">Device Log</p>
            {!isConnected ? (
              <p className="text-slate-500">&gt; Device offline</p>
            ) : (
              <>
                <p>&gt; Authenticated cart: {trimmedCartCode}</p>
                <p>&gt; Poll status: {pollStatus}</p>
                <p>&gt; Screen mode: {isActive ? 'ACTIVE SESSION' : cartStatus === 'AVAILABLE' ? 'PAIRING QR' : cartStatus}</p>
                {qrData && !isActive && <p>&gt; QR refreshed until {new Date(qrData.expiresAt).toLocaleTimeString()}</p>}
                {isQrLoading && !qrData && <p>&gt; Requesting fresh pairing QR...</p>}
                {deviceData?.active && <p>&gt; Session {(deviceData.cartSessionId || deviceData.session.id).slice(-6).toUpperCase()} pushed to device screen</p>}
                {isDisconnecting && <p>&gt; Releasing cart session and refreshing QR...</p>}
                {isResetting && <p>&gt; Resetting cart lifecycle from simulator...</p>}
                {eventLogs.map((entry) => (
                  <p key={entry}>&gt; {entry}</p>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="relative flex aspect-[4/3] flex-col overflow-hidden rounded-[2rem] border-[12px] border-slate-800 bg-black p-8 shadow-2xl">
            <div className="z-10 mb-8 flex items-center justify-between text-slate-400">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                <span className="font-bold tracking-widest">{trimmedCartCode || 'CART'}</span>
              </div>
              <div className="flex items-center gap-3">
                {isConnected && !deviceError ? (
                  <Wifi className="h-4 w-4 text-green-400" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-400" />
                )}
                <span className="text-sm font-medium">{connectionLabel}</span>
              </div>
            </div>

            <div className="z-10 flex flex-1 flex-col items-center justify-center text-center">
              {!isConnected ? (
                <div className="flex flex-col items-center text-slate-500">
                  <WifiOff className="mb-4 h-16 w-16 opacity-50" />
                  <p className="text-lg">No Power</p>
                </div>
              ) : isDeviceLoading && !deviceData ? (
                <div className="flex flex-col items-center text-slate-400">
                  <RefreshCw className="mb-4 h-12 w-12 animate-spin opacity-50" />
                  <p>Booting OS...</p>
                </div>
              ) : !isActive && cartStatus === 'AVAILABLE' ? (
                <div className="-translate-y-5 flex flex-col items-center">
                  <div className="mb-6 flex min-h-[240px] min-w-[240px] items-center justify-center rounded-3xl bg-white p-6 shadow-2xl">
                    {qrData?.qrValue ? (
                      <QRCode value={qrData.qrValue} size={192} />
                    ) : (
                      <RefreshCw className="h-8 w-8 animate-spin text-slate-300" />
                    )}
                  </div>
                  <h1 className="mb-2 text-3xl font-bold text-white">Scan to Shop</h1>
                  <p className="max-w-md text-lg text-slate-400">Use the Carto app to scan this live cart QR code.</p>
                  <div className="mt-6 grid grid-cols-1 gap-2 rounded-2xl bg-slate-800/50 px-6 py-4 text-left font-mono text-sm text-slate-300">
                    <div>Cart Code: {trimmedCartCode}</div>
                    <div>Pairing Code: {qrData?.payload?.pairingCode ?? 'Loading...'}</div>
                    <div>Expires: {qrData?.expiresAt ? new Date(qrData.expiresAt).toLocaleTimeString() : 'Loading...'}</div>
                  </div>
                </div>
              ) : !isActive ? (
                <div className="flex flex-col items-center text-slate-400">
                  <RefreshCw className="mb-4 h-12 w-12 animate-spin opacity-50" />
                  <p>Waiting for cart to return to AVAILABLE mode...</p>
                </div>
              ) : (
                <div className="flex h-full w-full flex-col items-start text-left">
                  <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500">
                      <Receipt className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-white">Active Session</h1>
                      <p className="text-indigo-300">{deviceData.list.name}</p>
                    </div>
                  </div>

                  <div className="grid min-h-0 w-full flex-1 grid-cols-2 gap-6">
                    <div className="overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                      <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">Shopping List</h3>
                      {deviceData.list.items.length === 0 ? (
                        <p className="italic text-slate-500">List is empty</p>
                      ) : (
                        <ul className="space-y-3">
                          {deviceData.list.items.map((item) => (
                            <li
                              key={item.id}
                              className={`flex items-center justify-between ${item.isCollected ? 'opacity-50 line-through' : ''}`}
                            >
                              <span className="text-slate-200">{item.name}</span>
                              <span className="text-slate-500">x{item.quantity}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="flex flex-col overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                      <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">Current Receipt</h3>
                      {!deviceData.receipt || deviceData.receipt.items.length === 0 ? (
                        <p className="flex-1 italic text-slate-500">Scan items to add them</p>
                      ) : (
                        <ul className="flex-1 space-y-3">
                          {deviceData.receipt.items.map((item) => (
                            <li key={item.id} className="flex items-center justify-between text-sm">
                              <span className="text-slate-300">
                                {item.name} <span className="text-slate-600">x{item.quantity}</span>
                              </span>
                              <span className="font-mono text-slate-300">
                                ${(item.price * item.quantity).toFixed(2)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-auto border-t border-slate-800 pt-4">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Total</span>
                          <span className="font-mono text-2xl font-bold text-white">
                            ${deviceData.receipt?.total?.toFixed(2) || '0.00'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.02] to-white/[0.08]" />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
