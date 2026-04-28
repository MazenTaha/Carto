// Reusable Button component

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-colors transition-transform duration-200 ' +
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
      'active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';
    
    const variants = {
      primary: 'bg-primary text-white shadow-glow hover:bg-primary-dark focus-visible:ring-primary',
      secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 focus-visible:ring-slate-400 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
      outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-primary dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
      ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-primary dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
    };
    
    const sizes = {
      sm: 'h-9 px-3 text-sm',
      md: 'h-11 px-4 text-sm',
      lg: 'h-14 px-6 text-base',
      icon: 'size-11 p-0',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

