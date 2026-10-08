import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ReceiptPanelProps {
  children: ReactNode;
  className?: string;
}

/** Card with a perforated top edge, used wherever Carto shows a receipt. */
export function ReceiptPanel({ children, className }: ReceiptPanelProps) {
  return (
    <section className={cn('relative overflow-hidden rounded-2xl border border-line bg-surface shadow-card', className)}>
      <div
        className="h-1.5 w-full bg-[repeating-linear-gradient(90deg,theme(colors.brand.700)_0_14px,transparent_14px_22px)]"
        aria-hidden="true"
      />
      {children}
    </section>
  );
}

export function ReceiptDivider({ className }: { className?: string }) {
  return <div className={cn('border-t border-dashed border-line-strong', className)} aria-hidden="true" />;
}
