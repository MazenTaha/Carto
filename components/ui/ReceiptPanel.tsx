import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ReceiptPanelProps {
  children: ReactNode;
  className?: string;
}

export function ReceiptPanel({ children, className }: ReceiptPanelProps) {
  return (
    <section className={cn('relative overflow-hidden rounded-3xl border border-warm-border/45 bg-white shadow-soft dark:border-warm-border/45 dark:bg-white', className)}>
      <div className="absolute inset-x-0 top-0 h-1 bg-[repeating-linear-gradient(90deg,#722F37_0_18px,transparent_18px_28px)] opacity-80" />
      {children}
    </section>
  );
}
