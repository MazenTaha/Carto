import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ReceiptPanelProps {
  children: ReactNode;
  className?: string;
}

export function ReceiptPanel({ children, className }: ReceiptPanelProps) {
  return (
    <section className={cn('relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900', className)}>
      <div className="absolute inset-x-0 top-0 h-1 bg-[repeating-linear-gradient(90deg,#059669_0_18px,transparent_18px_28px)] opacity-80" />
      {children}
    </section>
  );
}
