// Reusable Card component

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
}

export function Card({ children, className, title, subtitle }: CardProps) {
  return (
    <div className={cn('rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900', className)}>
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h2 className="text-lg font-bold text-slate-950 dark:text-slate-100">{title}</h2>}
          {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

