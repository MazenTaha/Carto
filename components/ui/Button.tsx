import Link, { type LinkProps } from 'next/link';
import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'danger-soft' | 'inverse';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const base =
  'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ' +
  'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 ' +
  '[&_svg]:size-[1.125rem] [&_svg]:shrink-0';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white shadow-brand hover:bg-primary-hover',
  secondary: 'bg-brand-50 text-primary hover:bg-brand-100',
  outline: 'border border-line-strong bg-surface text-ink shadow-xs hover:border-ink-subtle/40 hover:bg-surface-muted',
  ghost: 'text-ink-muted hover:bg-surface-sunken/70 hover:text-ink',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  'danger-soft': 'border border-red-200 bg-surface text-red-700 hover:border-red-300 hover:bg-red-50',
  inverse: 'bg-white text-primary shadow-xs hover:bg-brand-50',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-[0.9375rem]',
  icon: 'size-11 p-0',
  'icon-sm': 'size-9 p-0',
};

export function buttonVariants({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', fullWidth, loading = false, disabled, children, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={buttonVariants({ variant, size, fullWidth, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
);

Button.displayName = 'Button';

type ButtonLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
  };

export function ButtonLink({ className, variant = 'primary', size = 'md', fullWidth, ...props }: ButtonLinkProps) {
  return <Link className={buttonVariants({ variant, size, fullWidth, className })} {...props} />;
}
