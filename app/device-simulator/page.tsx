'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  CreditCard,
  Power,
  QrCode,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  SlidersHorizontal,
  SquareTerminal,
  Wifi,
  WifiOff,
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { PageContainer } from '@/components/layout/PageContainer';
import {
  DEMO_PAYMENT_AMOUNT_EGP,
  DEMO_PAYMENT_CURRENCY,
} from '@/lib/constants/demo-payment';
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
// Demo-only simulator state. Persisted device secrets here are not a production auth pattern.
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

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function normalizeItemName(name: string) {
  return name.trim().toLowerCase();
}

function hasValidPositivePrice(price: number | null | undefined) {
  return Number.isFinite(price) && Number(price) > 0;
}

const jsonFetcher = async ([url, deviceSecret]: [string, string]) => {
  const response = await fetch(url, {
    cache: 'no-store',
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
  const [demoPriceInput, setDemoPriceInput] = useState('1.00');
  const [isAddingListedItems, setIsAddingListedItems] = useState(false);
  const [showAddListedItemsDialog, setShowAddListedItemsDialog] = useState(false);
  const [listedItemsNotice, setListedItemsNotice] = useState<{
    tone: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
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
  const effectivePaymentAmount = DEMO_PAYMENT_AMOUNT_EGP;
  const paymentQrExpiresAtLabel = paymentQrData?.expiresAt
    ? new Date(paymentQrData.expiresAt).toLocaleTimeString()
    : null;
  const plannedShoppingListItems = useMemo(
    () => activeDeviceData?.shoppingList.items ?? [],
    [activeDeviceData?.shoppingList.items]
  );
  const currentReceiptItems = useMemo(
    () => activeDeviceData?.receipt?.items ?? [],
    [activeDeviceData?.receipt?.items]
  );
  const parsedDemoPrice = Number(demoPriceInput);
  const hasValidDemoPrice = Number.isFinite(parsedDemoPrice) && parsedDemoPrice > 0;
  const currentReceiptItemNames = useMemo(
    () => new Set(currentReceiptItems.map((item) => normalizeItemName(item.name))),
    [currentReceiptItems]
  );
  const listedItemsToAdd = useMemo(
    () => plannedShoppingListItems.filter((item) => !currentReceiptItemNames.has(normalizeItemName(item.name))),
    [currentReceiptItemNames, plannedShoppingListItems]
  );
  const listedItemsAlreadyInReceiptCount = plannedShoppingListItems.length - listedItemsToAdd.length;
  const listedItemsMissingPriceCount = useMemo(
    () => listedItemsToAdd.filter((item) => !hasValidPositivePrice(item.price)).length,
    [listedItemsToAdd]
  );
  const receiptIsPaidOrCompleted =
    activeDeviceData?.receipt?.status === 'PAID' ||
    activeDeviceData?.receipt?.paymentStatus === 'COMPLETED' ||
    activeDeviceData?.payment?.status === 'PAID';
  const receiptIsLocked = activeDeviceData?.receipt?.status === 'LOCKED';

  let addListedItemsDisabledReason: string | null = null;

  if (!isActive) {
    addListedItemsDisabledReason = 'No active session is available for this cart.';
  } else if (!trimmedCartCode || !trimmedDeviceSecret) {
    addListedItemsDisabledReason = 'Connect the simulator with a valid cart code and device secret first.';
  } else if (!activeDeviceData?.receipt?.id) {
    addListedItemsDisabledReason = 'No active receipt exists for this session.';
  } else if (receiptIsPaidOrCompleted) {
    addListedItemsDisabledReason = 'The receipt has already been paid or payment is completed.';
  } else if (receiptIsLocked) {
    addListedItemsDisabledReason = 'The receipt is locked for checkout and cannot accept more items.';
  } else if (plannedShoppingListItems.length === 0) {
    addListedItemsDisabledReason = 'No shopping list items are available to add.';
  } else if (listedItemsToAdd.length === 0) {
    addListedItemsDisabledReason = 'All listed items are already in the receipt.';
  } else if (listedItemsMissingPriceCount > 0 && !hasValidDemoPrice) {
    addListedItemsDisabledReason = 'Enter a valid demo price for listed items that do not have a price yet.';
  }

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
      setListedItemsNotice(null);
      setShowAddListedItemsDialog(false);
      paymentCompletionHandledRef.current = false;
      return;
    }

    if (paymentQrData?.cartSessionId && activeDeviceData?.cartSessionId && paymentQrData.cartSessionId !== activeDeviceData.cartSessionId) {
      setPaymentQrData(null);
      setPaymentStatusData(null);
      setPaymentError('');
      setListedItemsNotice(null);
      setShowAddListedItemsDialog(false);
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
    appendLog(`Requesting payment QR for cart ${trimmedCartCode} with ${formatDeviceMoney(effectivePaymentAmount, DEMO_PAYMENT_CURRENCY)}`);

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
          currency: DEMO_PAYMENT_CURRENCY,
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

  const handleConfirmAddListedItems = useCallback(async () => {
    if (!isActive || !trimmedCartCode || !trimmedDeviceSecret || isAddingListedItems) {
      return;
    }

    if (addListedItemsDisabledReason) {
      setListedItemsNotice({
        tone: 'error',
        message: addListedItemsDisabledReason,
      });
      return;
    }

    const itemsToAdd = listedItemsToAdd.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      category: item.category,
      price: hasValidPositivePrice(item.price) ? item.price : parsedDemoPrice,
    }));

    setIsAddingListedItems(true);
    setShowAddListedItemsDialog(false);
    setListedItemsNotice(null);
    setPaymentError('');
    setPaymentQrData(null);
    setPaymentStatusData(null);
    paymentCompletionHandledRef.current = false;

    const responseStatuses: number[] = [];
    let latestPayload: DeviceResponse | null = null;

    appendLog(`Adding ${itemsToAdd.length} listed item${itemsToAdd.length === 1 ? '' : 's'} to receipt...`);
    console.info('[DeviceSimulator] add-listed-items start', {
      cartCode: trimmedCartCode,
      itemCount: itemsToAdd.length,
    });

    try {
      for (const item of itemsToAdd) {
        const response = await fetch(`/api/carts/${encodeURIComponent(trimmedCartCode)}/items`, {
          method: 'POST',
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${trimmedDeviceSecret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            category: item.category ?? undefined,
          }),
        });

        responseStatuses.push(response.status);
        console.info('[DeviceSimulator] add-listed-items response', {
          cartCode: trimmedCartCode,
          itemCount: itemsToAdd.length,
          status: response.status,
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data?.success === false) {
          throw new Error(
            getApiErrorMessage(
              data,
              'Could not add listed items to receipt. Check the device secret and active session.'
            )
          );
        }

        latestPayload = data.data as DeviceResponse;
      }

      if (latestPayload) {
        await refreshDevice(latestPayload, { revalidate: false });
      }

      await refreshDevice();

      const nextMessage =
        listedItemsAlreadyInReceiptCount > 0
          ? `Listed items added to receipt. Payment QR can now be generated. ${listedItemsAlreadyInReceiptCount} item${listedItemsAlreadyInReceiptCount === 1 ? ' was' : 's were'} already in the receipt and skipped.`
          : 'Listed items added to receipt. Payment QR can now be generated.';

      setListedItemsNotice({
        tone: 'success',
        message: nextMessage,
      });
      appendLog(`Listed items added to receipt. ${listedItemsAlreadyInReceiptCount > 0 ? `Skipped ${listedItemsAlreadyInReceiptCount} existing item${listedItemsAlreadyInReceiptCount === 1 ? '' : 's'}.` : 'Payment QR is ready to generate.'}`);
      console.info('[DeviceSimulator] add-listed-items complete', {
        cartCode: trimmedCartCode,
        itemCount: itemsToAdd.length,
        responseStatuses,
      });
    } catch (error: any) {
      const message =
        error?.message || 'Could not add listed items to receipt. Check the device secret and active session.';

      setListedItemsNotice({
        tone: 'error',
        message,
      });
      appendLog(`Listed-item sync failed: ${message}`);
      await refreshDevice();
    } finally {
      setIsAddingListedItems(false);
    }
  }, [
    addListedItemsDisabledReason,
    appendLog,
    isActive,
    isAddingListedItems,
    listedItemsAlreadyInReceiptCount,
    listedItemsToAdd,
    parsedDemoPrice,
    refreshDevice,
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
  const lastPollLabel = lastPollAt ? new Date(lastPollAt).toLocaleTimeString() : 'Waiting...';
  const screenModeLabel = isActive ? 'Active session' : cartStatus === 'AVAILABLE' ? 'Pairing QR' : cartStatus;
  const paymentStatusLabel =
    paymentStatusData?.paymentStatus ||
    activeDeviceData?.receipt?.paymentStatus ||
    activeDeviceData?.payment?.status ||
    activeDeviceData?.receipt?.status ||
    'Not started';
  const paymentStatusNormalized = paymentStatusLabel.toUpperCase();
  const connectionBadgeClassName = cn(
    'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
    !isConnected
      ? 'border-rose-400/30 bg-rose-500/10 text-rose-200'
      : deviceError
        ? 'border-amber-400/30 bg-amber-500/10 text-amber-200'
        : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
  );
  const cartStatusBadgeClassName = cn(
    'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
    isActive
      ? 'border-sky-400/30 bg-sky-500/10 text-sky-200'
      : cartStatus === 'AVAILABLE'
        ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
        : 'border-amber-400/30 bg-amber-500/10 text-amber-200'
  );
  const paymentStatusBadgeClassName = cn(
    'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
    paymentStatusNormalized === 'PAID' || paymentStatusNormalized === 'COMPLETED'
      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
      : paymentStatusNormalized === 'PENDING' || paymentStatusNormalized === 'PROCESSING'
        ? 'border-amber-400/30 bg-amber-500/10 text-amber-200'
        : paymentStatusNormalized === 'FAILED'
          ? 'border-rose-400/30 bg-rose-500/10 text-rose-200'
          : 'border-slate-600 bg-slate-800/80 text-slate-200'
  );
  const sessionReference = activeDeviceData?.session.id
    ? activeDeviceData.session.id.slice(-6).toUpperCase()
    : null;
  const receiptReference = currentReceiptId ? currentReceiptId.slice(-6).toUpperCase() : null;

  return (
    <PageContainer>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_28%)] px-6 py-6 sm:px-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                  <QrCode className="h-3.5 w-3.5" />
                  Device Simulator
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                  Live cart preview with pairing, session, receipt, and payment handoff
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-400 sm:text-base">
                  The simulator logic stays the same. This cleanup makes the control panel, device screen, and log much easier to read while keeping cart pairing, session polling, payment QR generation, and disconnect flows intact.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[440px] xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Connection
                  </p>
                  <p className="mt-3 text-base font-semibold text-slate-950 dark:text-white">{connectionLabel}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Cart
                  </p>
                  <p className="mt-3 text-base font-semibold text-slate-950 dark:text-white">
                    {trimmedCartCode || DEFAULT_SIMULATOR_CART_CODE}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Screen
                  </p>
                  <p className="mt-3 text-base font-semibold text-slate-950 dark:text-white">{screenModeLabel}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Last poll
                  </p>
                  <p className="mt-3 text-base font-semibold text-slate-950 dark:text-white">{lastPollLabel}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-start">
          <div className="space-y-6">
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-6 flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Device Config</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    Choose the demo cart, confirm its secret, then power on the simulator.
                  </p>
                </div>
              </div>

              <form onSubmit={handleConnect} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Demo Cart
                  </label>
                  <select
                    value={selectedPresetCartCode}
                    onChange={(event) => {
                      const nextPreset = getDemoCartPreset(event.target.value);
                      applyCartPreset(event.target.value, nextPreset?.deviceSecret);
                    }}
                    disabled={isConnected}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] text-slate-950 transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600 dark:focus:ring-slate-800"
                  >
                    {DEMO_CART_PRESETS.map((preset) => (
                      <option key={preset.cartCode} value={preset.cartCode}>
                        {preset.label} ({preset.cartCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Cart Code
                  </label>
                  <input
                    type="text"
                    value={cartCode}
                    onChange={(event) => setCartCode(event.target.value)}
                    disabled={isConnected}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] text-slate-950 transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600 dark:focus:ring-slate-800"
                    placeholder="cart-02"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Device Secret
                  </label>
                  <input
                    type="text"
                    value={deviceSecret}
                    onChange={(event) => setDeviceSecret(event.target.value)}
                    disabled={isConnected}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] text-slate-950 transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600 dark:focus:ring-slate-800"
                    placeholder="Device secret for the selected cart"
                  />
                  <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
                    Presets default to the repo demo secrets. If your current database uses a custom secret for{' '}
                    {trimmedCartCode || DEFAULT_SIMULATOR_CART_CODE}, replace it here before connecting.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Pairing code
                    </p>
                    <p className="mt-3 font-mono text-lg font-semibold text-slate-950 dark:text-white">
                      {qrData?.payload?.pairingCode ?? 'Waiting...'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Expires
                    </p>
                    <p className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">
                      {qrData?.expiresAt ? new Date(qrData.expiresAt).toLocaleTimeString() : 'Waiting...'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Cart status
                    </p>
                    <p className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">{cartStatus}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Poll status
                    </p>
                    <p className="mt-3 text-sm font-medium leading-6 text-slate-700 dark:text-slate-300">
                      {pollStatus}
                    </p>
                  </div>
                </div>

                {deviceError && (
                  <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{deviceError.message}</p>
                  </div>
                )}

                {qrError && (
                  <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{qrError.message}</p>
                  </div>
                )}

                {paymentError && (
                  <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{paymentError}</p>
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Simulator controls
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {isConnected ? (
                      <button
                        type="button"
                        onClick={handleDisconnect}
                        disabled={isDisconnecting}
                        className="col-span-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200"
                      >
                        {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className="col-span-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
                      >
                        Power On and Connect
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void refreshDevice()}
                      disabled={!isConnected || isDisconnecting}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Poll now
                    </button>
                    <button
                      type="button"
                      onClick={() => void refreshQr()}
                      disabled={!isConnected || isDisconnecting || isActive || cartStatus !== 'AVAILABLE'}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Refresh QR
                    </button>
                    {process.env.NODE_ENV !== 'production' && (
                      <button
                        type="button"
                        onClick={() => void handleResetCart()}
                        disabled={!isConnected || isResetting || isDisconnecting}
                        className="col-span-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                      >
                        {isResetting ? 'Resetting Cart...' : 'Reset Cart'}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>

            <div className="overflow-hidden rounded-[1.75rem] border border-slate-800 bg-slate-950 shadow-sm">
              <div className="border-b border-slate-800 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
                    <SquareTerminal className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Device Log</h2>
                    <p className="mt-1 text-sm text-slate-500">Live simulator events and backend polling activity.</p>
                  </div>
                </div>
              </div>
              <div className="max-h-[320px] min-h-[280px] overflow-y-auto px-5 py-4 font-mono text-xs text-emerald-300 sm:text-sm">
                {!isConnected ? (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/70 px-4 py-3 text-slate-500">
                    &gt; Device offline
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-slate-300">
                      &gt; Authenticated cart: {trimmedCartCode}
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-slate-300">
                      &gt; Poll status: {pollStatus}
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-slate-300">
                      &gt; Screen mode: {screenModeLabel.toUpperCase()}
                    </div>
                    {qrData && !isActive && (
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-slate-300">
                        &gt; QR refreshed until {new Date(qrData.expiresAt).toLocaleTimeString()}
                      </div>
                    )}
                    {isQrLoading && !qrData && (
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-slate-300">
                        &gt; Requesting fresh pairing QR...
                      </div>
                    )}
                    {deviceData?.active && (
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-slate-300">
                        &gt; Session {(deviceData.cartSessionId || deviceData.session.id).slice(-6).toUpperCase()} pushed to device screen
                      </div>
                    )}
                    {paymentQrData && (
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-slate-300">
                        &gt; Payment QR live for receipt {paymentQrData.receiptId.slice(-6).toUpperCase()}
                      </div>
                    )}
                    {paymentStatusData && (
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-slate-300">
                        &gt; Payment status: {paymentStatusData.paymentStatus}
                      </div>
                    )}
                    {isGeneratingPaymentQr && (
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-slate-300">
                        &gt; Creating secure payment QR...
                      </div>
                    )}
                    {isCheckingPaymentStatus && (
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-slate-300">
                        &gt; Polling payment status every 2s...
                      </div>
                    )}
                    {isDisconnecting && (
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-slate-300">
                        &gt; Releasing cart session and refreshing QR...
                      </div>
                    )}
                    {isResetting && (
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-slate-300">
                        &gt; Resetting cart lifecycle from simulator...
                      </div>
                    )}
                    {eventLogs.map((entry) => (
                      <div key={entry} className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-emerald-300">
                        &gt; {entry}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.75rem] border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Live Device Preview
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
                    Full-size cart screen
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={connectionBadgeClassName}>
                    {isConnected && !deviceError ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                    {connectionLabel}
                  </span>
                  <span className={cartStatusBadgeClassName}>{cartStatus}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[2.25rem] bg-gradient-to-br from-slate-200 via-white to-slate-100 p-3 shadow-[0_24px_80px_rgba(15,23,42,0.14)] dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
              <div className="relative overflow-hidden rounded-[2rem] border-[14px] border-slate-950 bg-[#050816] shadow-2xl">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_30%)]" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.02] to-white/[0.08]" />

                <div className="relative flex min-h-[680px] flex-col px-5 py-5 sm:px-7 sm:py-6 xl:min-h-[860px]">
                  <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white/10 text-white backdrop-blur">
                        <ShoppingCart className="h-7 w-7" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                          Cart device
                        </p>
                        <h3 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
                          {trimmedCartCode || 'Cart'}
                        </h3>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                          {pollStatus}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className={connectionBadgeClassName}>
                        {isConnected && !deviceError ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <Power className="h-3.5 w-3.5" />
                        )}
                        {connectionLabel}
                      </span>
                      <span className={cartStatusBadgeClassName}>{screenModeLabel}</span>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col">
                    {!isConnected ? (
                      <div className="flex flex-1 items-center justify-center">
                        <div className="max-w-xl text-center">
                          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/10 bg-white/5 text-slate-300 shadow-lg backdrop-blur">
                            <Power className="h-11 w-11" />
                          </div>
                          <h1 className="mt-6 text-3xl font-semibold text-white sm:text-4xl">Simulator offline</h1>
                          <p className="mt-4 text-base leading-8 text-slate-400">
                            Power on the simulator to load the live pairing QR, active-session state, and secure checkout handoff for this cart.
                          </p>
                        </div>
                      </div>
                    ) : isDeviceLoading && !deviceData ? (
                      <div className="flex flex-1 items-center justify-center">
                        <div className="max-w-xl text-center">
                          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/10 bg-white/5 text-slate-300 shadow-lg backdrop-blur">
                            <RefreshCw className="h-11 w-11 animate-spin" />
                          </div>
                          <h1 className="mt-6 text-3xl font-semibold text-white sm:text-4xl">Booting cart OS</h1>
                          <p className="mt-4 text-base leading-8 text-slate-400">
                            The simulator is polling the backend and preparing the device state.
                          </p>
                        </div>
                      </div>
                    ) : !isActive && cartStatus === 'AVAILABLE' ? (
                      <div className="grid flex-1 gap-8 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-center">
                        <div className="mx-auto flex w-full max-w-[360px] items-center justify-center rounded-[2.5rem] bg-white p-7 shadow-[0_30px_80px_rgba(15,23,42,0.35)]">
                          {qrData?.qrValue ? (
                            <QRCode value={qrData.qrValue} size={280} />
                          ) : (
                            <RefreshCw className="h-10 w-10 animate-spin text-slate-300" />
                          )}
                        </div>

                        <div className="space-y-6">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-300">
                              Ready to pair
                            </p>
                            <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
                              Scan this live QR to start shopping
                            </h1>
                            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
                              Use the Carto app to scan this cart. The pairing code stays live on the device surface and refreshes through the backend.
                            </p>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-3">
                            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 px-5 py-5 backdrop-blur">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Cart code
                              </p>
                              <p className="mt-3 text-xl font-semibold text-white">{trimmedCartCode}</p>
                            </div>
                            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 px-5 py-5 backdrop-blur">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Pairing code
                              </p>
                              <p className="mt-3 font-mono text-xl font-semibold text-white">
                                {qrData?.payload?.pairingCode ?? 'Loading...'}
                              </p>
                            </div>
                            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 px-5 py-5 backdrop-blur">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Expires
                              </p>
                              <p className="mt-3 text-xl font-semibold text-white">
                                {qrData?.expiresAt ? new Date(qrData.expiresAt).toLocaleTimeString() : 'Loading...'}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-[1.75rem] border border-sky-400/20 bg-sky-500/10 px-5 py-5 text-sky-50">
                            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-200">
                              Scan flow
                            </p>
                            <p className="mt-3 text-base leading-7 text-sky-50/90">
                              Keep the simulator powered on, then scan this cart from the mobile app to push the active shopping session onto the device screen.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : !isActive ? (
                      <div className="flex flex-1 items-center justify-center">
                        <div className="max-w-xl text-center">
                          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/10 bg-white/5 text-slate-300 shadow-lg backdrop-blur">
                            <Clock3 className="h-11 w-11" />
                          </div>
                          <h1 className="mt-6 text-3xl font-semibold text-white sm:text-4xl">
                            Waiting for pairing mode
                          </h1>
                          <p className="mt-4 text-base leading-8 text-slate-400">
                            The cart is not currently in AVAILABLE mode. Disconnect or finish the current workflow to show the live pairing QR again.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-h-0 flex-1 flex-col">
                        <div className="mb-6 rounded-[1.75rem] border border-white/10 bg-white/5 p-5 backdrop-blur">
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-indigo-500/90 text-white shadow-lg">
                                <ReceiptText className="h-7 w-7" />
                              </div>
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-300">
                                  Active session
                                </p>
                                <h1 className="mt-2 text-2xl font-semibold text-white">{deviceData.list.name}</h1>
                                <p className="mt-1 text-sm text-slate-300">
                                  {sessionReference ? `Session ${sessionReference}` : 'Session is active on this cart'}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {activeSessionStatus && <span className={cartStatusBadgeClassName}>{activeSessionStatus}</span>}
                              {activeReceiptStatus && <span className={paymentStatusBadgeClassName}>{activeReceiptStatus}</span>}
                              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                                {deviceData.list.items.length} list item{deviceData.list.items.length === 1 ? '' : 's'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid min-h-0 flex-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
                          <div className="flex min-h-0 flex-col rounded-[1.9rem] border border-sky-400/20 bg-slate-950/60 p-5">
                            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-200">
                                  <ShoppingCart className="h-6 w-6" />
                                </div>
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-300">
                                    Shopping List
                                  </p>
                                  <h3 className="mt-1 text-xl font-semibold text-white">
                                    Planned items for this trip
                                  </h3>
                                </div>
                              </div>
                              <span className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">
                                {deviceData.list.items.length} item{deviceData.list.items.length === 1 ? '' : 's'}
                              </span>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                              {deviceData.list.items.length === 0 ? (
                                <div className="rounded-[1.75rem] border border-dashed border-slate-700 bg-slate-950/60 px-5 py-6 text-sm text-slate-400">
                                  No items are currently planned for this list.
                                </div>
                              ) : (
                                <ul className="space-y-3">
                                  {deviceData.list.items.map((item) => (
                                    <li
                                      key={item.id}
                                      className={cn(
                                        'flex items-center justify-between rounded-[1.5rem] border px-4 py-4 transition',
                                        item.isCollected
                                          ? 'border-slate-800 bg-slate-900/60 opacity-55'
                                          : 'border-sky-400/10 bg-slate-900/80'
                                      )}
                                    >
                                      <div className="min-w-0 pr-4">
                                        <p
                                          className={cn(
                                            'truncate text-base font-medium',
                                            item.isCollected ? 'text-slate-500 line-through' : 'text-slate-100'
                                          )}
                                        >
                                          {item.name}
                                        </p>
                                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                                          {item.category || 'Uncategorized'}
                                        </p>
                                      </div>
                                      <span className="shrink-0 rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                                        Qty {item.quantity}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>

                            <div className="mt-5 rounded-[1.75rem] border border-amber-400/20 bg-amber-400/10 p-5">
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-100">
                                  <AlertTriangle className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                                    Demo receipt sync
                                  </p>
                                  <p className="mt-2 text-sm leading-6 text-amber-50/90">
                                    This simulator-only action calls the real cart item API to confirm planned items into the receipt for testing.
                                  </p>
                                </div>
                              </div>

                              <div className="mt-5">
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-amber-100/80">
                                  Demo price for listed items without price
                                </label>
                                <div className="flex items-center gap-3">
                                  <span className="rounded-2xl border border-amber-300/20 bg-slate-950/60 px-4 py-3 text-sm font-semibold text-amber-50">
                                    EGP
                                  </span>
                                  <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={demoPriceInput}
                                    onChange={(event) => setDemoPriceInput(event.target.value)}
                                    disabled={isAddingListedItems}
                                    className="w-full rounded-2xl border border-amber-300/20 bg-slate-950/60 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                                    placeholder="1.00"
                                  />
                                </div>
                                <p className="mt-3 text-xs leading-6 text-amber-50/70">
                                  Used only when a planned list item does not already have a valid price.
                                </p>
                                {listedItemsMissingPriceCount > 0 && !hasValidDemoPrice && (
                                  <p className="mt-2 text-xs text-red-100">
                                    Enter a valid positive demo price before adding listed items to the receipt.
                                  </p>
                                )}
                              </div>

                              <div className="mt-4 rounded-[1.5rem] border border-amber-300/20 bg-slate-950/50 p-4 text-sm text-amber-50/85">
                                <p>
                                  {listedItemsToAdd.length} listed item{listedItemsToAdd.length === 1 ? '' : 's'} ready to add.
                                </p>
                                {listedItemsAlreadyInReceiptCount > 0 && (
                                  <p className="mt-2">
                                    {listedItemsAlreadyInReceiptCount} item{listedItemsAlreadyInReceiptCount === 1 ? '' : 's'} already exist in the receipt and will be skipped.
                                  </p>
                                )}
                                {listedItemsMissingPriceCount > 0 && (
                                  <p className="mt-2">
                                    {listedItemsMissingPriceCount} item{listedItemsMissingPriceCount === 1 ? '' : 's'} will use the demo fallback price of{' '}
                                    {hasValidDemoPrice ? formatDeviceMoney(parsedDemoPrice) : 'a valid price'}.
                                  </p>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => setShowAddListedItemsDialog(true)}
                                disabled={Boolean(addListedItemsDisabledReason) || isAddingListedItems}
                                className="mt-4 w-full rounded-2xl bg-amber-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isAddingListedItems ? 'Adding listed items to receipt...' : 'Add listed items to receipt'}
                              </button>

                              {addListedItemsDisabledReason && (
                                <p className="mt-3 text-xs leading-6 text-amber-50/70">{addListedItemsDisabledReason}</p>
                              )}

                              {listedItemsNotice && (
                                <div
                                  className={cn(
                                    'mt-4 rounded-[1.5rem] px-4 py-3 text-sm',
                                    listedItemsNotice.tone === 'success'
                                      ? 'bg-emerald-500/15 text-emerald-100'
                                      : listedItemsNotice.tone === 'error'
                                        ? 'bg-rose-500/15 text-rose-100'
                                        : 'bg-slate-800 text-slate-200'
                                  )}
                                >
                                  {listedItemsNotice.message}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex min-h-0 flex-col rounded-[1.9rem] border border-emerald-400/20 bg-slate-950/70 p-5">
                            <div className="mb-5 flex flex-col gap-4">
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-200">
                                    <CreditCard className="h-6 w-6" />
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                                      Current Receipt
                                    </p>
                                    <h3 className="mt-1 text-xl font-semibold text-white">Checkout and payment</h3>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void handleGeneratePaymentQr()}
                                  disabled={!deviceData.receipt?.id || isGeneratingPaymentQr}
                                  className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {isGeneratingPaymentQr
                                    ? 'Generating payment QR...'
                                    : paymentQrData
                                      ? 'Generate new payment QR'
                                      : 'Generate payment QR'}
                                </button>
                              </div>

                              <p className="text-sm leading-6 text-slate-400">
                                The device sends the payable amount to the backend, and the QR only carries a short-lived token.
                              </p>
                            </div>

                            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                    Checkout amount
                                  </p>
                                  <p className="mt-2 text-sm leading-6 text-slate-300">
                                    Demo mode always charges a fixed{' '}
                                    {formatDeviceMoney(DEMO_PAYMENT_AMOUNT_EGP, DEMO_PAYMENT_CURRENCY)} regardless of the current receipt total.
                                  </p>
                                </div>
                                <span className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
                                  {formatDeviceMoney(effectivePaymentAmount, DEMO_PAYMENT_CURRENCY)}
                                </span>
                              </div>
                              <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                                <span className="text-slate-500">Amount sent in POST body</span>
                                <span className="font-mono font-bold text-white">
                                  {formatDeviceMoney(effectivePaymentAmount, DEMO_PAYMENT_CURRENCY)}
                                </span>
                              </div>
                            </div>

                            {paymentQrData ? (
                              <div className="mt-5 rounded-[1.9rem] border border-emerald-400/25 bg-slate-950/90 p-5 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                                      Secure payment QR
                                    </p>
                                    <p className="mt-2 text-sm text-slate-300">
                                      Scan on a phone to continue secure checkout.
                                    </p>
                                  </div>
                                  <span className={paymentStatusBadgeClassName}>
                                    {paymentStatusData?.paymentStatus || paymentQrData.paymentStatus}
                                  </span>
                                </div>

                                <div className="mt-5 flex justify-center rounded-[1.8rem] bg-white p-6 shadow-inner">
                                  <QRCode value={paymentQrData.qrValue} size={240} />
                                </div>

                                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                      Amount
                                    </p>
                                    <p className="mt-2 text-base font-semibold text-white">{paymentQrData.amountDisplay}</p>
                                  </div>
                                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                      Receipt
                                    </p>
                                    <p className="mt-2 font-mono text-base font-semibold text-white">
                                      {paymentQrData.receiptId.slice(-6).toUpperCase()}
                                    </p>
                                  </div>
                                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                      Expires
                                    </p>
                                    <p className="mt-2 text-base font-semibold text-white">
                                      {paymentQrExpiresAtLabel}
                                    </p>
                                  </div>
                                </div>

                                {paymentStatusData?.paymentStatus === 'PAID' ? (
                                  <div className="mt-5 rounded-[1.5rem] bg-emerald-500/15 px-4 py-4 text-sm font-semibold text-emerald-100">
                                    Payment successful. Returning cart to pairing mode...
                                  </div>
                                ) : (
                                  <p className="mt-5 text-sm leading-7 text-slate-400">
                                    The QR only contains a short-lived token. Carto loads the stored amount from the backend after scan.
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="mt-5 rounded-[1.75rem] border border-dashed border-slate-700 bg-white/[0.03] px-5 py-4 text-sm leading-7 text-slate-400">
                                {deviceData.payment?.status === 'PENDING'
                                  ? `Payment is pending for ${formatDeviceMoney(deviceData.payment.amount, deviceData.payment.currency)}. Generate a fresh QR to continue on a phone.`
                                  : 'Generate a payment QR when the shopper is ready to pay on their phone.'}
                              </div>
                            )}

                            <div className="mt-5 flex min-h-0 flex-1 flex-col rounded-[1.75rem] border border-white/10 bg-white/5 p-4">
                              <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                    Receipt items
                                  </p>
                                  <p className="mt-1 text-sm text-slate-400">
                                    {receiptReference ? `Receipt ${receiptReference}` : 'No receipt items yet'}
                                  </p>
                                </div>
                                <span className="inline-flex items-center rounded-full border border-white/10 bg-slate-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                                  {deviceData.receipt?.items.length || 0} item{deviceData.receipt?.items.length === 1 ? '' : 's'}
                                </span>
                              </div>

                              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                                {!deviceData.receipt || deviceData.receipt.items.length === 0 ? (
                                  <div className="rounded-[1.5rem] border border-dashed border-slate-700 bg-slate-950/60 px-4 py-5 text-sm text-slate-400">
                                    Scan or sync items to start building the receipt.
                                  </div>
                                ) : (
                                  <ul className="space-y-3">
                                    {deviceData.receipt.items.map((item) => (
                                      <li
                                        key={item.id}
                                        className="flex items-center justify-between rounded-[1.5rem] border border-emerald-400/10 bg-slate-950/70 px-4 py-4 text-sm"
                                      >
                                        <div className="min-w-0 pr-4">
                                          <p className="truncate font-medium text-slate-100">{item.name}</p>
                                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                                            Qty {item.quantity}
                                          </p>
                                        </div>
                                        <span className="font-mono text-slate-100">
                                          {formatDeviceMoney(item.price * item.quantity)}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>

                            <div className="mt-5 rounded-[1.75rem] border border-emerald-400/15 bg-emerald-500/10 px-5 py-4">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-medium text-emerald-100/80">Total</span>
                                <span className="font-mono text-3xl font-bold text-white">
                                  {formatDeviceMoney(deviceData.receipt?.total || 0)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAddListedItemsDialog && isActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-md rounded-[2rem] border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-200">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Add listed items to receipt</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  This will simulate scanning all planned shopping list items and add them to the receipt. Continue?
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2 rounded-[1.5rem] border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
              <p>{listedItemsToAdd.length} listed item{listedItemsToAdd.length === 1 ? '' : 's'} will be added.</p>
              {listedItemsAlreadyInReceiptCount > 0 && (
                <p>{listedItemsAlreadyInReceiptCount} item{listedItemsAlreadyInReceiptCount === 1 ? '' : 's'} already in the receipt will be skipped.</p>
              )}
              {listedItemsMissingPriceCount > 0 && (
                <p>
                  {listedItemsMissingPriceCount} item{listedItemsMissingPriceCount === 1 ? '' : 's'} will use the demo fallback price of {formatDeviceMoney(hasValidDemoPrice ? parsedDemoPrice : 0)}.
                </p>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddListedItemsDialog(false)}
                disabled={isAddingListedItems}
                className="rounded-2xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmAddListedItems()}
                disabled={isAddingListedItems}
                className="rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
              >
                {isAddingListedItems ? 'Adding listed items to receipt...' : 'Confirm add items'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
