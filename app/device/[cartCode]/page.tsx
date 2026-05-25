'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';

type DeviceState =
  | {
      active: false;
      cart: {
        cartCode: string;
        status: string;
      };
    }
  | {
      active: true;
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
    setDeviceSecret(window.localStorage.getItem(storageKey) || '');
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

    window.localStorage.setItem(storageKey, deviceSecret.trim());
    void fetchActiveSession();
    const interval = setInterval(fetchActiveSession, 3000);

    return () => clearInterval(interval);
  }, [deviceSecret, fetchActiveSession, storageKey]);

  const collectedCount = data?.active
    ? data.list.items.filter((item) => item.isCollected).length
    : 0;

  return (
    <PageContainer maxWidth="lg">
      <main className="flex-1 pb-10 pt-6">
        <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-soft">
          <Badge className="bg-white/10 text-white ring-white/15">Device test display</Badge>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight">{params.cartCode}</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">
                This development page polls the backend with a device secret and shows the live list assigned to this cart.
              </p>
            </div>
            <Badge variant={data?.active ? 'success' : 'warning'} className="w-fit">
              {data?.active ? 'Active session' : data?.cart.status || 'Waiting'}
            </Badge>
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <label className="block text-xs font-black uppercase tracking-[0.16em] text-slate-500" htmlFor="device-secret">
            Device secret
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              id="device-secret"
              value={deviceSecret}
              onChange={(event) => setDeviceSecret(event.target.value)}
              placeholder="dev-device-secret"
              className="h-12 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
            <Button onClick={fetchActiveSession} disabled={!deviceSecret.trim() || isLoading}>
              {isLoading ? 'Checking...' : 'Poll now'}
            </Button>
          </div>
          {error && (
            <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </p>
          )}
        </section>

        {!data?.active ? (
          <section className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-card dark:border-slate-800 dark:bg-slate-900">
            <span className="material-symbols-outlined text-5xl text-primary">qr_code_scanner</span>
            <h2 className="mt-4 text-2xl font-black text-slate-950 dark:text-slate-100">Waiting for shopper to scan QR...</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Generate a QR for this cart, select a list on the shopper app, and scan the QR to assign the list.
            </p>
          </section>
        ) : (
          <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Assigned list</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-slate-100">{data.list.name}</h2>
                </div>
                <Badge variant="success">{collectedCount}/{data.list.items.length} collected</Badge>
              </div>
              <div className="space-y-3">
                {data.list.items.map((item) => (
                  <article
                    key={item.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <span className="material-symbols-outlined text-primary">
                      {item.isCollected ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-black text-slate-950 dark:text-slate-100">{item.name}</h3>
                      <p className="text-sm text-slate-500">{item.category || 'General'} · Qty {item.quantity}</p>
                    </div>
                    <p className="font-black text-slate-950 dark:text-slate-100">
                      {formatCurrency((item.price || 0) * item.quantity)}
                    </p>
                  </article>
                ))}
              </div>
            </div>

            <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Receipt</p>
              <h2 className="mt-2 text-xl font-black text-slate-950 dark:text-slate-100">
                {data.receipt?.status || 'No receipt'}
              </h2>
              <div className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-black">{formatCurrency(data.receipt?.subtotal || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tax</span>
                  <span className="font-black">{formatCurrency(data.receipt?.tax || 0)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-3 text-base dark:border-slate-800">
                  <span className="font-black">Total</span>
                  <span className="font-black text-primary">{formatCurrency(data.receipt?.total || 0)}</span>
                </div>
              </div>
            </aside>
          </section>
        )}
      </main>
    </PageContainer>
  );
}
