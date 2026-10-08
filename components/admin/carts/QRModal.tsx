'use client';

import { Clock } from 'lucide-react';
import { AdminCart } from '@/types/admin';
import { Modal } from '@/components/ui/Modal';

interface QRModalProps {
  open: boolean;
  onClose: () => void;
  cart: AdminCart | null;
  qrData: { qrDataUrl: string; pairingCode: string; expiresAt: string } | null;
}

export function QRModal({ open, onClose, cart, qrData }: QRModalProps) {
  const isOpen = open && Boolean(cart && qrData);
  const expiresIn = qrData ? Math.max(0, Math.floor((new Date(qrData.expiresAt).getTime() - Date.now()) / 1000 / 60)) : 0;

  return (
    <Modal open={isOpen} onClose={onClose} size="sm" title="Cart pairing QR" description={cart ? `Scan to link a list to ${cart.cartCode}.` : undefined}>
      {cart && qrData && (
        <div className="text-center">
          <div className="mx-auto w-fit rounded-2xl border border-line bg-white p-3 shadow-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrData.qrDataUrl} alt={`Pairing QR code for ${cart.cartCode}`} width={220} height={220} className="rounded-lg" />
          </div>

          <div className="mt-5 rounded-xl bg-surface-muted px-4 py-3">
            <p className="text-xs font-medium text-ink-subtle">Pairing code</p>
            <p className="tabular mt-1 font-mono text-2xl font-semibold tracking-[0.3em] text-ink">{qrData.pairingCode}</p>
          </div>

          <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
            <Clock className="size-3.5" aria-hidden="true" />
            Expires in {expiresIn} minute{expiresIn !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </Modal>
  );
}
