import { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger' | 'brand';

const toneStyles: Record<AlertTone, { box: string; icon: string; Icon: LucideIcon }> = {
  info: { box: 'border-sky-200 bg-sky-50 text-sky-900', icon: 'text-sky-600', Icon: Info },
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: 'text-emerald-600', Icon: CircleCheck },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', icon: 'text-amber-600', Icon: TriangleAlert },
  danger: { box: 'border-red-200 bg-red-50 text-red-800', icon: 'text-red-600', Icon: CircleAlert },
  brand: { box: 'border-brand-200 bg-brand-50 text-brand-900', icon: 'text-primary', Icon: Info },
};

interface AlertProps {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}

export function Alert({ tone = 'info', title, children, icon, action, className }: AlertProps) {
  const style = toneStyles[tone];
  const Icon = icon ?? style.Icon;

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm animate-fade-in', style.box, className)}
    >
      <Icon className={cn('mt-0.5 size-[1.125rem] shrink-0', style.icon)} aria-hidden="true" />
      <div className="min-w-0 flex-1 leading-6">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'opacity-90')}>{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
