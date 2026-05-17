'use client';

import { AdminCart } from '@/types/admin';
import { X, Clock, QrCode } from 'lucide-react';
import Image from 'next/image';

interface QRModalProps {
  open: boolean;
  onClose: () => void;
  cart: AdminCart | null;
  qrData: { qrDataUrl: string; pairingCode: string; expiresAt: string } | null;
}

export function QRModal({ open, onClose, cart, qrData }: QRModalProps) {
  if (!open || !cart || !qrData) return null;

  const expiresIn = Math.max(
    0,
    Math.floor((new Date(qrData.expiresAt).getTime() - Date.now()) / 1000 / 60)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100">
          <X size={16} />
        </button>

        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <QrCode size={20} />
        </div>
        <h2 className="text-base font-bold text-slate-900">Cart QR Code</h2>
        <p className="mt-0.5 text-sm text-slate-500 font-mono">{cart.cartCode}</p>

        <div className="my-5 mx-auto w-fit rounded-2xl border-4 border-slate-100 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrData.qrDataUrl} alt="Cart QR" width={220} height={220} className="rounded-xl" />
        </div>

        <div className="rounded-xl bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-400 mb-1">Pairing Code</p>
          <p className="text-2xl font-bold font-mono tracking-widest text-slate-900">
            {qrData.pairingCode}
          </p>
        </div>

        <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-amber-600">
          <Clock size={11} />
          Expires in {expiresIn} minute{expiresIn !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
