'use client';

import { AdminCart } from '@/types/admin';
import { StatusBadge } from '@/components/admin/shared/StatusBadge';
import { ConfirmDialog } from '@/components/admin/shared/ConfirmDialog';
import { QRModal } from './QRModal';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  ShoppingCart, RefreshCw, QrCode, Wifi, WifiOff,
  MoreVertical, Settings,
} from 'lucide-react';
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

  const STATUS_COLORS: Record<string, string> = {
    AVAILABLE:   'border-emerald-200 bg-emerald-50/30',
    IN_USE:      'border-indigo-200 bg-indigo-50/30',
    MAINTENANCE: 'border-amber-200 bg-amber-50/30',
    OFFLINE:     'border-red-200 bg-red-50/30',
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {carts.map((cart) => (
          <div
            key={cart.id}
            className={cn(
              'relative rounded-2xl border-2 bg-white p-5 shadow-sm transition-shadow hover:shadow-md',
              STATUS_COLORS[cart.status] ?? 'border-slate-100'
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <ShoppingCart size={17} />
                </div>
                <div>
                  <p className="font-bold text-slate-900 font-mono text-sm">{cart.cartCode}</p>
                  <p className="text-[10px] text-slate-400 truncate max-w-[100px]">
                    {cart.storeName ?? 'Unknown store'}
                  </p>
                </div>
              </div>

              {/* Menu */}
              <div className="relative">
                <button
                  onClick={() => setOpenMenu(openMenu === cart.id ? null : cart.id)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                >
                  <MoreVertical size={15} />
                </button>
                {openMenu === cart.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                    <div className="absolute right-0 top-7 z-20 w-44 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                      {['AVAILABLE','IN_USE','MAINTENANCE','OFFLINE'].map((s) => (
                        <button key={s} onClick={async () => { await onSetStatus(cart.id, s); setOpenMenu(null); }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">
                          <Settings size={11} /> Set to {s.replace('_',' ')}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Status & Battery */}
            <div className="mt-3 flex items-center justify-between">
              <StatusBadge status={cart.status} pulse={cart.status === 'IN_USE'} />
              <span
                className={cn(
                  'rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider',
                  cart.hasDeviceSecret
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                )}
              >
                {cart.hasDeviceSecret ? 'Device ready' : 'No secret'}
              </span>
            </div>

            {/* Connectivity */}
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
              {cart.isOnline
                ? <><Wifi size={11} className="text-emerald-500" /> Online</>
                : <><WifiOff size={11} className="text-red-400" /> Offline</>
              }
              <span className="ml-auto text-[10px] text-slate-400">
                {formatDistanceToNow(new Date(cart.lastSeen), { addSuffix: true })}
              </span>
            </div>

            {/* Active session pill */}
            {cart.currentSession && (
              <div className="mt-3 rounded-lg bg-indigo-50 px-3 py-2">
                <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">Active Session</p>
                <p className="text-xs font-medium text-indigo-800 truncate">
                  {cart.currentSession.userEmail ?? 'Guest'}
                </p>
                <p className="text-[10px] text-indigo-400 truncate">{cart.currentSession.listName}</p>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={async () => {
                  const result = await onGenerateQR(cart.id);
                  if (result?.data) { setQrData(result.data); setQrTarget(cart); }
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <QrCode size={13} /> QR Code
              </button>
              <button
                onClick={() => setResetTarget(cart)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-200 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50"
              >
                <RefreshCw size={13} /> Reset
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title={`Reset cart "${resetTarget?.cartCode}"?`}
        description="This will end all active sessions and mark the cart as Available."
        confirmLabel="Reset Cart"
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
        onClose={() => { setQrTarget(null); setQrData(null); }}
        cart={qrTarget}
        qrData={qrData}
      />
    </>
  );
}
