// Reusable Input component

import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            'h-12 w-full rounded-xl border border-warm-border/55 bg-white px-4 text-slate-900 placeholder:text-slate-400 shadow-sm dark:border-warm-border/55 dark:bg-white dark:text-slate-900',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary',
            'transition-colors duration-200',
            error && 'border-red-500 focus:ring-red-500',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-2 text-sm font-medium text-red-600">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

