'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Circle, CircleCheck, KeyRound, RefreshCw, ScanLine } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';
import { PageHeader } from '@/components/ui/PageHeader';
import { ReceiptDivider, ReceiptPanel } from '@/components/ui/ReceiptPanel';
import { formatCurrency } from '@/lib/utils';

type DeviceState =
  | {
      status?: 'waiting';
      active: false;
      cartCode?: string;
      cartStatus?: string;
      cart: {
        cartCode: string;
        status: string;
      };
    }
  | {
      status?: 'active';
      active: true;
      cartCode?: string;
      cartStatus?: string;
      cartSessionId?: string;
      receiptId?: string | null;
      shoppingList?: {
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

function getApiErrorMessage(data: any, fallback: string) {
  if (data?.error?.message) return data.error.message;
  if (typeof data?.error === 'string') return data.error;
  return fallback;
}

export default function DevicePage({ params }: { params: { cartCode: string } }) {
  const storageKey = useMemo(() => `carto_device_secret_${params.cartCode}`, [params.cartCode]);
  const [deviceSecret, setDeviceSecret] = useState('');
  const [data, setData] = useState<DeviceState | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    try {
      setDeviceSecret(window.localStorage.getItem(storageKey) || '');
    } catch {}
  }, [storageKey]);

  const fetchActiveSession = useCallback(async () => {
    if (!deviceSecret.trim()) {
      setData(null);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/carts/${encodeURIComponent(params.cartCode)}/active-session`, {
        headers: {
          Authorization: `Bearer ${deviceSecret.trim()}`,
        },
        cache: 'no-store',
      });
      const nextData = await response.json();

      if (!response.ok || nextData?.success === false) {
        throw new Error(getApiErrorMessage(nextData, 'Could not connect to cart device endpoint.'));
      }

      setData(nextData.data);
    } catch (err: any) {
      setError(err.message || 'Could not connect to cart device endpoint.');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [deviceSecret, params.cartCode]);

  useEffect(() => {
    if (!deviceSecret.trim()) return;

    try {
      window.localStorage.setItem(storageKey, deviceSecret.trim());
    } catch {}
    void fetchActiveSession();
    const interval = setInterval(fetchActiveSession, 2000);

    return () => clearInterval(interval);
  }, [deviceSecret, fetchActiveSession, storageKey]);

  const collectedCount = data?.active
    ? data.list.items.filter((item) => item.isCollected).length
    : 0;
  const cartStatus = data?.cartStatus ?? data?.cart.status ?? 'Waiting';

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Logo height={24} priority />
          <Badge tone="neutral" className="hidden sm:inline-flex">
            Device test display
          </Badge>
          <div className="ml-auto">
            <Badge tone={data?.active ? 'success' : 'neutral'} dot pulse={Boolean(data?.active)}>
              {data?.active ? 'Session active' : cartStatus.replace('_', ' ').toLowerCase()}
            </Badge>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader
          title={<span className="font-mono">{params.cartCode}</span>}
          description="Development view that polls the device API every 2 seconds and shows the list assigned to this cart."
        />

        <form
          className="surface-card mt-6 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void fetchActiveSession();
          }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input
              id="device-secret"
              label="Device secret"
              hint="Saved on this device for next time."
              value={deviceSecret}
              onChange={(event) => setDeviceSecret(event.target.value)}
              placeholder="dev-device-secret"
              autoComplete="off"
              leading={<KeyRound aria-hidden="true" />}
              containerClassName="flex-1"
            />
            <Button type="submit" size="lg" disabled={!deviceSecret.trim()} loading={isLoading} className="sm:mb-7">
              {!isLoading && <RefreshCw aria-hidden="true" />}
              {isLoading ? 'Checking…' : 'Poll now'}
            </Button>
          </div>
          {error && (
            <Alert tone="danger" className="mt-4">
              {error}
            </Alert>
          )}
        </form>

        {!data?.active ? (
          <EmptyState
            icon={ScanLine}
            className="mt-6"
            title={deviceSecret.trim() ? 'Waiting for a shopper to scan…' : 'Enter the device secret to connect'}
            description="Show this cart's pairing QR, choose a list in the shopper app, and scan it to assign the list here."
          />
        ) : (
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <section aria-labelledby="assigned-list" className="surface-card overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-5">
                <div className="min-w-0">
                  <p className="eyebrow">Assigned list</p>
                  <h2 id="assigned-list" className="mt-1 truncate text-xl font-semibold">
                    {data.list.name}
                  </h2>
                </div>
                <Badge tone="brand">
                  {collectedCount}/{data.list.items.length} collected
                </Badge>
              </div>
              <ul className="divide-y divide-line border-t border-line">
                {data.list.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                    {item.isCollected ? (
                      <CircleCheck className="size-5 shrink-0 text-emerald-600" aria-label="Collected" />
                    ) : (
                      <Circle className="size-5 shrink-0 text-line-strong" aria-label="Not collected" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={item.isCollected ? 'truncate font-medium text-ink-subtle line-through' : 'truncate font-medium text-ink'}>
                        {item.name}
                      </p>
                      <p className="text-xs text-ink-subtle">
                        {item.category || 'General'} · Qty {item.quantity}
                      </p>
                    </div>
                    <p className="tabular shrink-0 text-sm font-medium text-ink">{formatCurrency((item.price || 0) * item.quantity)}</p>
                  </li>
                ))}
              </ul>
            </section>

            <ReceiptPanel className="lg:sticky lg:top-6">
              <div className="flex items-center justify-between px-5 pb-4 pt-5">
                <h2 className="text-base font-semibold">Receipt</h2>
                <Badge tone="neutral">{data.receipt?.status || 'No receipt'}</Badge>
              </div>
              <ReceiptDivider />
              <div className="space-y-2 px-5 py-4 text-sm">
                <div className="flex justify-between text-ink-muted">
                  <span>Subtotal</span>
                  <span className="tabular">{formatCurrency(data.receipt?.subtotal || 0)}</span>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <span>Tax</span>
                  <span className="tabular">{formatCurrency(data.receipt?.tax || 0)}</span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="font-semibold text-ink">Total</span>
                  <span className="tabular font-display text-2xl font-semibold text-ink">{formatCurrency(data.receipt?.total || 0)}</span>
                </div>
              </div>
            </ReceiptPanel>
          </div>
        )}
      </main>
    </div>
  );
}
