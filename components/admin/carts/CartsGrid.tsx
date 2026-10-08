'use client';

import { AdminCart } from '@/types/admin';
import { StatusBadge } from '@/components/admin/shared/StatusBadge';
import { ConfirmDialog } from '@/components/admin/shared/ConfirmDialog';
import { QRModal } from './QRModal';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MoreVertical, QrCode, RefreshCw, Settings, ShoppingCart, Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface CartsGridProps {
  carts: AdminCart[];
  onReset: (cartId: string) => Promise<void>;
  onSetStatus: (cartId: string, status: string) => Promise<void>;
  onGenerateQR: (cartId: string) => Promise<any>;
}

export function CartsGrid({ carts, onReset, onSetStatus, onGenerateQR }: CartsGridProps) {
  const [resetTarget, setResetTarget] = useState<AdminCart | null>(null);
  const [resetting, setResetting] = useState(false);
  const [qrTarget, setQrTarget] = useState<AdminCart | null>(null);
  const [qrData, setQrData] = useState<any>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const STATUS_ACCENTS: Record<string, string> = {
    AVAILABLE: 'before:bg-emerald-500',
    IN_USE: 'before:bg-primary',
    MAINTENANCE: 'before:bg-amber-500',
    OFFLINE: 'before:bg-red-500',
  };

  return (
    <>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {carts.map((cart) => (
          <li
            key={cart.id}
            className={cn(
              'surface-card relative flex flex-col overflow-hidden p-5 before:absolute before:inset-x-0 before:top-0 before:h-1',
              STATUS_ACCENTS[cart.status] ?? 'before:bg-line-strong'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-ink-muted">
                  <ShoppingCart className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-ink">{cart.cartCode}</p>
                  <p className="truncate text-xs text-ink-subtle">{cart.storeName ?? 'Unknown store'}</p>
                </div>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === cart.id ? null : cart.id)}
                  aria-haspopup="menu"
                  aria-expanded={openMenu === cart.id}
                  aria-label={`Change status of ${cart.cartCode}`}
                  className="-mr-2 -mt-1 flex size-9 items-center justify-center rounded-lg text-ink-subtle transition hover:bg-surface-muted hover:text-ink"
                >
                  <MoreVertical className="size-4" aria-hidden="true" />
                </button>
                {openMenu === cart.id && (
                  <>
                    <div className="fixed inset-0 z-10" aria-hidden="true" onClick={() => setOpenMenu(null)} />
                    <div role="menu" className="absolute right-0 top-9 z-20 w-48 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-raised animate-rise-in">
                      <p className="px-3 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-ink-subtle">Set status</p>
                      {['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OFFLINE'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          role="menuitem"
                          disabled={cart.status === s}
                          onClick={async () => {
                            await onSetStatus(cart.id, s);
                            setOpenMenu(null);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink transition hover:bg-surface-muted disabled:text-ink-subtle disabled:hover:bg-transparent"
                        >
                          <Settings className="size-3.5 text-ink-subtle" aria-hidden="true" />
                          <span className="capitalize">{s.replace('_', ' ').toLowerCase()}</span>
                          {cart.status === s && <span className="ml-auto text-2xs text-ink-subtle">Current</span>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <StatusBadge status={cart.status} pulse={cart.status === 'IN_USE'} />
              <Badge tone={cart.hasDeviceSecret ? 'neutral' : 'warning'}>{cart.hasDeviceSecret ? 'Device ready' : 'No device secret'}</Badge>
            </div>

            <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-muted">
              {cart.isOnline ? (
                <Wifi className="size-3.5 text-emerald-600" aria-hidden="true" />
              ) : (
                <WifiOff className="size-3.5 text-red-500" aria-hidden="true" />
              )}
              {cart.isOnline ? 'Online' : 'Offline'}
              <span className="ml-auto text-ink-subtle">Seen {formatDistanceToNow(new Date(cart.lastSeen), { addSuffix: true })}</span>
            </p>

            {cart.currentSession && (
              <div className="mt-3 rounded-xl bg-brand-50 px-3 py-2.5">
                <p className="text-2xs font-semibold uppercase tracking-wider text-primary">Active session</p>
                <p className="mt-0.5 truncate text-sm font-medium text-ink">{cart.currentSession.userEmail ?? 'Guest'}</p>
                <p className="truncate text-xs text-ink-muted">{cart.currentSession.listName}</p>
              </div>
            )}

            <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const result = await onGenerateQR(cart.id);
                  if (result?.data) {
                    setQrData(result.data);
                    setQrTarget(cart);
                  }
                }}
              >
                <QrCode aria-hidden="true" />
                QR code
              </Button>
              <Button variant="outline" size="sm" onClick={() => setResetTarget(cart)}>
                <RefreshCw aria-hidden="true" />
                Reset
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title={`Reset ${resetTarget?.cartCode}?`}
        description="This ends any active session on the cart and marks it as available."
        confirmLabel="Reset cart"
        variant="warning"
        loading={resetting}
        onConfirm={async () => {
          if (!resetTarget) return;
          setResetting(true);
          await onReset(resetTarget.id);
          setResetting(false);
          setResetTarget(null);
        }}
      />

      <QRModal
        open={!!qrTarget}
        onClose={() => {
          setQrTarget(null);
          setQrData(null);
        }}
        cart={qrTarget}
        qrData={qrData}
      />
    </>
  );
}
