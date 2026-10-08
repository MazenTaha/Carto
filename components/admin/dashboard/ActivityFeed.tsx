import { ActivityEvent } from '@/types/admin';
import { Activity, CreditCard, ShoppingCart, UserPlus, WifiOff, type LucideIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const EVENT_CONFIG: Record<string, { icon: LucideIcon; className: string }> = {
  session_started: { icon: ShoppingCart, className: 'bg-brand-50 text-primary' },
  session_ended: { icon: Activity, className: 'bg-surface-muted text-ink-muted' },
  cart_offline: { icon: WifiOff, className: 'bg-red-50 text-red-600' },
  payment_completed: { icon: CreditCard, className: 'bg-emerald-50 text-emerald-600' },
  user_registered: { icon: UserPlus, className: 'bg-sky-50 text-sky-600' },
};

const DEFAULT_CONFIG = { icon: Activity, className: 'bg-surface-muted text-ink-muted' };

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (!events.length) {
    return <p className="py-8 text-center text-sm text-ink-subtle">No recent activity yet.</p>;
  }

  return (
    <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[0.9375rem] before:top-2 before:w-px before:bg-line">
      {events.map((event) => {
        const cfg = EVENT_CONFIG[event.type] ?? DEFAULT_CONFIG;
        const Icon = cfg.icon;
        const timestamp = new Date(event.timestamp);

        return (
          <li key={event.id} className="relative flex items-start gap-3">
            <span className={`relative flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-surface ${cfg.className}`}>
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-sm leading-snug text-ink">{event.message}</p>
              <time dateTime={timestamp.toISOString()} className="mt-0.5 block text-xs text-ink-subtle">
                {formatDistanceToNow(timestamp, { addSuffix: true })}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
