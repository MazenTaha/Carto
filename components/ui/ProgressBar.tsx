import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  className?: string;
  label?: string;
}

export function ProgressBar({ value, className, label }: ProgressBarProps) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
          <span>{label}</span>
          <span>{safeValue}%</span>
        </div>
      )}
      <div className="h-3 overflow-hidden rounded-full bg-primary/10">
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}
