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
      'inline-flex touch-manipulation items-center justify-center gap-2 font-semibold rounded-xl ' +
      'transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150 ease-out will-change-transform ' +
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
      'active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';
    
    const variants = {
      primary: 'bg-primary text-white shadow-glow hover:bg-primary-dark focus-visible:ring-primary',
      secondary: 'border border-warm-border bg-primary-soft text-primary hover:border-primary/40 hover:bg-white focus-visible:ring-primary dark:border-warm-border dark:bg-primary-soft dark:text-primary dark:hover:bg-white',
      outline: 'border border-warm-border bg-white text-primary hover:border-primary/50 hover:bg-primary-soft focus-visible:ring-primary dark:border-warm-border dark:bg-white dark:text-primary dark:hover:bg-primary-soft',
      ghost: 'bg-transparent text-primary hover:bg-primary/10 hover:text-primary-dark focus-visible:ring-primary dark:text-primary dark:hover:bg-primary/10 dark:hover:text-primary-dark',
      danger: 'bg-primary-dark text-white hover:bg-primary focus-visible:ring-primary',
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

