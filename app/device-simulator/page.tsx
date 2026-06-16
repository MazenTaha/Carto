'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { RefreshCw, Receipt, ShoppingCart, Wifi, WifiOff } from 'lucide-react';
import QRCode from 'react-qr-code';
import { PageContainer } from '@/components/layout/PageContainer';
import {
  DEFAULT_SIMULATOR_CART_CODE,
  DEMO_CART_CODE,
  DEMO_CART_PRESETS,
  DEMO_DEVICE_SECRET,
  getDefaultSimulatorCartPreset,
  getDemoCartPreset,
  normalizeCartCode,
} from '@/lib/cart-code';
import { formatCurrency } from '@/lib/utils';

const STORAGE_KEY = 'carto_device_simulator_config_v2';
const LEGACY_STORAGE_KEY = 'carto_device_simulator_config';
const DEFAULT_SIMULATOR_PRESET = getDefaultSimulatorCartPreset();
const KNOWN_PRESET_SECRETS = new Set(DEMO_CART_PRESETS.map((preset) => preset.deviceSecret));
const LEGACY_CART_02_DEVICE_SECRET = 'dev-device-secret-02';

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
        currency?: string;
        paymentStatus?: string | null;
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
      payment?: {
        receiptId: string;
        status: string;
        currency: string;
        amount: number;
        amountCents?: number;
        paymentUrl: string | null;
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

type PaymentQrResponse = {
  type: 'payment_checkout';
  paymentAttemptId: string;
  paymentUrl: string;
  qrValue: string;
  receiptId: string;
  sessionId: string;
  cartSessionId: string;
  amountCents: number;
  amount: number;
  amountDisplay: string;
  currency: string;
  paymentStatus: string;
  expiresAt: string;
};

type PaymentStatusResponse = {
  receiptId: string;
  cartSessionId: string;
  paymentStatus: string;
  receiptStatus: string;
  cartSessionStatus: string;
  cartStatus: string;
  amount: number;
  currency: string;
  paidAt: string | null;
};

function getApiErrorMessage(data: any, fallback: string) {
  if (data?.error?.message) return data.error.message;
  if (typeof data?.error === 'string') return data.error;
  return fallback;
}

function formatDeviceMoney(amount: number, currency = 'EGP') {
  return formatCurrency(amount, currency);
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
  const [deviceSecret, setDeviceSecret] = useState(DEFAULT_SIMULATOR_PRESET.deviceSecret);
  const [cartCode, setCartCode] = useState(DEFAULT_SIMULATOR_CART_CODE);
  const [isConnected, setIsConnected] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [lastPollAt, setLastPollAt] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [eventLogs, setEventLogs] = useState<string[]>([]);
  const [paymentQrData, setPaymentQrData] = useState<PaymentQrResponse | null>(null);
  const [paymentStatusData, setPaymentStatusData] = useState<PaymentStatusResponse | null>(null);
  const [paymentError, setPaymentError] = useState<string>('');
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>('1');
  const [isGeneratingPaymentQr, setIsGeneratingPaymentQr] = useState(false);
  const [isCheckingPaymentStatus, setIsCheckingPaymentStatus] = useState(false);
  const paymentCompletionHandledRef = useRef(false);

  const appendLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setEventLogs((current) => [`[${timestamp}] ${message}`, ...current].slice(0, 10));
  }, []);

  const applyCartPreset = useCallback((nextCartCode: string, nextDeviceSecret?: string | null) => {
    const normalizedCartCode = normalizeCartCode(nextCartCode) || DEFAULT_SIMULATOR_PRESET.cartCode;
    const preset = getDemoCartPreset(normalizedCartCode);

    setCartCode(normalizedCartCode);
    setDeviceSecret((currentDeviceSecret) => {
      const trimmedCurrentSecret = currentDeviceSecret.trim();

      if (nextDeviceSecret && nextDeviceSecret.trim()) {
        return nextDeviceSecret.trim();
      }

      if (!preset) {
        return trimmedCurrentSecret;
      }

      if (!trimmedCurrentSecret || KNOWN_PRESET_SECRETS.has(trimmedCurrentSecret)) {
        return preset.deviceSecret;
      }

      return trimmedCurrentSecret;
    });
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { cartCode?: string; deviceSecret?: string };
        const normalizedCartCode = normalizeCartCode(parsed.cartCode ?? '');
        const trimmedDeviceSecret = parsed.deviceSecret?.trim() ?? '';

        const shouldMigrateOldDefault =
          normalizedCartCode === DEMO_CART_CODE &&
          trimmedDeviceSecret === DEMO_DEVICE_SECRET;
        const shouldRepairLegacyCart02Secret =
          normalizedCartCode === DEFAULT_SIMULATOR_CART_CODE &&
          trimmedDeviceSecret === LEGACY_CART_02_DEVICE_SECRET;

        if (shouldMigrateOldDefault || shouldRepairLegacyCart02Secret) {
          applyCartPreset(DEFAULT_SIMULATOR_PRESET.cartCode, DEFAULT_SIMULATOR_PRESET.deviceSecret);
        } else if (normalizedCartCode) {
          applyCartPreset(normalizedCartCode, trimmedDeviceSecret);
        }
      }
    } catch {}

    setHydrated(true);
  }, [applyCartPreset]);

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

  const trimmedCartCode = normalizeCartCode(cartCode);
  const trimmedDeviceSecret = deviceSecret.trim();
  const selectedPresetCartCode = getDemoCartPreset(cartCode)?.cartCode ?? '';
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
  const activeDeviceData = isActive ? deviceData : null;
  const currentReceiptId = paymentQrData?.receiptId || activeDeviceData?.receiptId || activeDeviceData?.payment?.receiptId || null;
  const activeCartSessionId = activeDeviceData?.cartSessionId || null;
  const activeReceiptStatus = activeDeviceData?.receipt?.status || null;
  const activeSessionStatus = activeDeviceData?.session.status || null;
  const parsedPaymentAmountInput = Number(paymentAmountInput);
  const effectivePaymentAmount = activeDeviceData?.receipt?.total && activeDeviceData.receipt.total > 0
    ? activeDeviceData.receipt.total
    : Number.isFinite(parsedPaymentAmountInput) && parsedPaymentAmountInput > 0
      ? parsedPaymentAmountInput
      : 1;
  const paymentQrExpiresAtLabel = paymentQrData?.expiresAt
    ? new Date(paymentQrData.expiresAt).toLocaleTimeString()
    : null;

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

  useEffect(() => {
    if (!isActive) {
      setPaymentQrData(null);
      setPaymentStatusData(null);
      setPaymentError('');
      paymentCompletionHandledRef.current = false;
      return;
    }

    if (paymentQrData?.cartSessionId && activeDeviceData?.cartSessionId && paymentQrData.cartSessionId !== activeDeviceData.cartSessionId) {
      setPaymentQrData(null);
      setPaymentStatusData(null);
      setPaymentError('');
      paymentCompletionHandledRef.current = false;
    }
  }, [activeDeviceData?.cartSessionId, isActive, paymentQrData?.cartSessionId]);

  const fetchPaymentStatus = useCallback(async () => {
    if (!trimmedCartCode || !trimmedDeviceSecret || !currentReceiptId) {
      return null;
    }

    setIsCheckingPaymentStatus(true);

    try {
      const response = await fetch(
        `/api/carts/${encodeURIComponent(trimmedCartCode)}/payment-status?receiptId=${encodeURIComponent(currentReceiptId)}`,
        {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${trimmedDeviceSecret}`,
          },
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.success === false) {
        throw new Error(getApiErrorMessage(data, 'Could not fetch payment status.'));
      }

      const nextStatus = data.data as PaymentStatusResponse;
      setPaymentStatusData(nextStatus);
      setPaymentError('');
      return nextStatus;
    } catch (error: any) {
      setPaymentError(error.message || 'Could not fetch payment status.');
      appendLog(`Payment status failed: ${error.message || 'Safe error unavailable.'}`);
      return null;
    } finally {
      setIsCheckingPaymentStatus(false);
    }
  }, [appendLog, currentReceiptId, trimmedCartCode, trimmedDeviceSecret]);

  useEffect(() => {
    if (!paymentQrData || !currentReceiptId || !isActive) {
      return;
    }

    let cancelled = false;
    let intervalId: number | null = null;
    let successTimeoutId: number | null = null;

    const poll = async () => {
      const status = await fetchPaymentStatus();
      if (cancelled || !status) {
        return;
      }

      if (status.paymentStatus === 'PAID' && !paymentCompletionHandledRef.current) {
        paymentCompletionHandledRef.current = true;
        appendLog(`Payment confirmed for receipt ${status.receiptId.slice(-6).toUpperCase()}`);
        successTimeoutId = window.setTimeout(() => {
          setPaymentQrData(null);
          setPaymentStatusData(status);
          void refreshDevice();
          void refreshQr();
        }, 2200);
      }
    };

    void poll();
    intervalId = window.setInterval(() => {
      void poll();
    }, 2000);

    return () => {
      cancelled = true;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      if (successTimeoutId) {
        window.clearTimeout(successTimeoutId);
      }
    };
  }, [appendLog, currentReceiptId, fetchPaymentStatus, isActive, paymentQrData, refreshDevice, refreshQr]);

  const handleGeneratePaymentQr = useCallback(async () => {
    if (!isActive || !trimmedCartCode || !trimmedDeviceSecret || isGeneratingPaymentQr) {
      return;
    }

    setIsGeneratingPaymentQr(true);
    setPaymentError('');
    setPaymentQrData(null);
    paymentCompletionHandledRef.current = false;
    appendLog(`Requesting payment QR for cart ${trimmedCartCode} with ${formatDeviceMoney(effectivePaymentAmount)}`);

    try {
      const response = await fetch(`/api/carts/${encodeURIComponent(trimmedCartCode)}/payment-qr`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${trimmedDeviceSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: effectivePaymentAmount,
          currency: activeDeviceData?.receipt?.currency || activeDeviceData?.payment?.currency || 'EGP',
          items: activeDeviceData?.receipt?.items?.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            total: item.price * item.quantity,
          })) ?? [],
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.success === false) {
        throw new Error(getApiErrorMessage(data, 'Could not create payment QR.'));
      }

      const nextPaymentQr = data.data as PaymentQrResponse;
      setPaymentQrData(nextPaymentQr);
      setPaymentStatusData({
        receiptId: nextPaymentQr.receiptId,
        cartSessionId: nextPaymentQr.cartSessionId,
        paymentStatus: nextPaymentQr.paymentStatus,
        receiptStatus: activeReceiptStatus || 'LOCKED',
        cartSessionStatus: activeSessionStatus || 'ACTIVE',
        cartStatus,
        amount: nextPaymentQr.amount,
        currency: nextPaymentQr.currency,
        paidAt: null,
      });
      appendLog(`Payment QR ready for receipt ${nextPaymentQr.receiptId.slice(-6).toUpperCase()}`);
    } catch (error: any) {
      setPaymentError(error.message || 'Could not create payment QR.');
      appendLog(`Payment QR failed: ${error.message || 'Safe error unavailable.'}`);
    } finally {
      setIsGeneratingPaymentQr(false);
    }
  }, [
    appendLog,
    activeDeviceData?.payment?.currency,
    activeDeviceData?.receipt?.currency,
    activeDeviceData?.receipt?.items,
    activeReceiptStatus,
    activeSessionStatus,
    cartStatus,
    effectivePaymentAmount,
    isActive,
    isGeneratingPaymentQr,
    trimmedCartCode,
    trimmedDeviceSecret,
  ]);

  const handleConnect = (event: React.FormEvent) => {
    event.preventDefault();
    if (!trimmedCartCode || !trimmedDeviceSecret) return;
    setPaymentQrData(null);
    setPaymentStatusData(null);
    setPaymentError('');
    paymentCompletionHandledRef.current = false;
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
      setPaymentQrData(null);
      setPaymentStatusData(null);
      setPaymentError('');
      paymentCompletionHandledRef.current = false;
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
      setPaymentQrData(null);
      setPaymentStatusData(null);
      setPaymentError('');
      paymentCompletionHandledRef.current = false;
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
                  Demo Cart
                </label>
                <select
                  value={selectedPresetCartCode}
                  onChange={(event) => {
                    const nextPreset = getDemoCartPreset(event.target.value);
                    applyCartPreset(event.target.value, nextPreset?.deviceSecret);
                  }}
                  disabled={isConnected}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950"
                >
                  {DEMO_CART_PRESETS.map((preset) => (
                    <option key={preset.cartCode} value={preset.cartCode}>
                      {preset.label} ({preset.cartCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Cart Code
                </label>
                <input
                  type="text"
                  value={cartCode}
                  onChange={(event) => setCartCode(event.target.value)}
                  disabled={isConnected}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950"
                  placeholder="cart-02"
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
                  placeholder="Device secret for the selected cart"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Presets default to the repo demo secrets. If your current database uses a custom secret for {trimmedCartCode || DEFAULT_SIMULATOR_CART_CODE}, replace it here before connecting.
                </p>
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

              {paymentError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
                  {paymentError}
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
                {paymentQrData && <p>&gt; Payment QR live for receipt {paymentQrData.receiptId.slice(-6).toUpperCase()}</p>}
                {paymentStatusData && <p>&gt; Payment status: {paymentStatusData.paymentStatus}</p>}
                {isGeneratingPaymentQr && <p>&gt; Creating secure payment QR...</p>}
                {isCheckingPaymentStatus && <p>&gt; Polling payment status every 2s...</p>}
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

            <div className="z-10 flex min-h-0 flex-1 flex-col items-center justify-center text-center">
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
                  <div className="mb-6 flex min-h-[260px] min-w-[260px] items-center justify-center rounded-3xl bg-white p-6 shadow-2xl">
                    {qrData?.qrValue ? (
                      <QRCode value={qrData.qrValue} size={220} />
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
                <div className="flex h-full w-full min-h-0 flex-col items-start overflow-y-auto pr-1 text-left">
                  <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500">
                      <Receipt className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-white">Active Session</h1>
                      <p className="text-indigo-300">{deviceData.list.name}</p>
                    </div>
                  </div>

                  <div className="grid min-h-0 w-full flex-1 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.92fr)]">
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

                    <div className="flex min-h-0 flex-col rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Current Receipt</h3>
                          <p className="mt-1 text-xs text-slate-500">
                            The device sends the payable amount to the backend, and the QR only carries a short-lived token.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleGeneratePaymentQr()}
                          disabled={!deviceData.receipt?.id || isGeneratingPaymentQr}
                          className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isGeneratingPaymentQr ? 'Generating payment QR...' : paymentQrData ? 'Generate new payment QR' : 'Generate payment QR'}
                        </button>
                      </div>
                      <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Checkout amount</p>
                            <p className="mt-1 text-sm text-slate-400">
                              {deviceData.receipt?.total && deviceData.receipt.total > 0
                                ? 'Using the live receipt total from the cart device.'
                                : 'Receipt total is zero, so the simulator will send a small demo amount unless you override it.'}
                            </p>
                          </div>
                          <div className="min-w-[148px]">
                            <input
                              type="number"
                              min="1"
                              step="0.01"
                              value={paymentAmountInput}
                              onChange={(event) => setPaymentAmountInput(event.target.value)}
                              disabled={(deviceData.receipt?.total || 0) > 0 || isGeneratingPaymentQr}
                              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-right text-sm font-semibold text-white disabled:opacity-50"
                              placeholder="1.00"
                            />
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm">
                          <span className="text-slate-500">Amount sent in POST body</span>
                          <span className="font-mono font-bold text-white">{formatDeviceMoney(effectivePaymentAmount)}</span>
                        </div>
                      </div>
                      {paymentQrData ? (
                        <div className="mt-4 rounded-3xl border border-emerald-500/30 bg-slate-950 p-5 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">Secure payment QR</p>
                            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-200">
                              {paymentStatusData?.paymentStatus || paymentQrData.paymentStatus}
                            </span>
                          </div>
                          <div className="mt-4 flex justify-center rounded-3xl bg-white p-5 shadow-inner">
                            <QRCode value={paymentQrData.qrValue} size={220} />
                          </div>
                          <div className="mt-4 space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Amount</span>
                              <span className="font-bold text-white">{paymentQrData.amountDisplay}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Receipt</span>
                              <span className="font-mono font-semibold text-slate-200">{paymentQrData.receiptId.slice(-6).toUpperCase()}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Expires</span>
                              <span className="font-semibold text-slate-200">{paymentQrExpiresAtLabel}</span>
                            </div>
                          </div>
                          {paymentStatusData?.paymentStatus === 'PAID' ? (
                            <div className="mt-4 rounded-2xl bg-emerald-500/15 px-4 py-3 text-sm font-bold text-emerald-200">
                              Payment successful. Returning cart to pairing mode...
                            </div>
                          ) : (
                            <>
                              <p className="mt-4 text-sm font-medium text-slate-300">
                                Scan this QR with your phone to continue secure checkout.
                              </p>
                              <p className="mt-2 text-sm text-slate-400">
                                The QR only contains a short-lived token. Carto loads the stored amount from the backend after scan.
                              </p>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-dashed border-slate-700 px-4 py-3 text-sm text-slate-400">
                          {deviceData.payment?.status === 'PENDING'
                            ? `Payment is pending for ${formatDeviceMoney(deviceData.payment.amount, deviceData.payment.currency)}. Generate a fresh QR to continue on a phone.`
                            : 'Generate a payment QR when the shopper is ready to pay on their phone.'}
                        </div>
                      )}

                      <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Receipt items</p>
                          <span className="text-xs font-semibold text-slate-500">
                            {deviceData.receipt?.items.length || 0} item{deviceData.receipt?.items.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        {!deviceData.receipt || deviceData.receipt.items.length === 0 ? (
                          <p className="italic text-slate-500">Scan items to add them</p>
                        ) : (
                          <ul className="space-y-3">
                            {deviceData.receipt.items.map((item) => (
                              <li key={item.id} className="flex items-center justify-between text-sm">
                                <span className="text-slate-300">
                                  {item.name} <span className="text-slate-600">x{item.quantity}</span>
                                </span>
                                <span className="font-mono text-slate-300">
                                  {formatDeviceMoney(item.price * item.quantity)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="mt-4 border-t border-slate-800 pt-4">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Total</span>
                          <span className="font-mono text-2xl font-bold text-white">
                            {formatDeviceMoney(deviceData.receipt?.total || 0)}
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
