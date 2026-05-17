import { ActivityEvent } from '@/types/admin';
import { Activity, ShoppingCart, UserPlus, Wifi, WifiOff, CreditCard } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const EVENT_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  session_started:    { icon: ShoppingCart, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  session_ended:      { icon: Activity,     color: 'text-slate-500',  bg: 'bg-slate-100' },
  cart_offline:       { icon: WifiOff,      color: 'text-red-500',    bg: 'bg-red-50' },
  payment_completed:  { icon: CreditCard,   color: 'text-emerald-600',bg: 'bg-emerald-50' },
  user_registered:    { icon: UserPlus,     color: 'text-violet-600', bg: 'bg-violet-50' },
};

const DEFAULT_CONFIG = { icon: Activity, color: 'text-slate-500', bg: 'bg-slate-100' };

interface ActivityFeedProps {
  events: ActivityEvent[];
}

export function ActivityFeed({ events }: ActivityFeedProps) {
  if (!events.length) {
    return <p className="py-6 text-center text-sm text-slate-400">No recent activity</p>;
  }

  return (
    <ol className="space-y-3">
      {events.map((event, idx) => {
        const cfg = EVENT_CONFIG[event.type] ?? DEFAULT_CONFIG;
        const Icon = cfg.icon;
        return (
          <li key={event.id} className="flex items-start gap-3">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${cfg.bg}`}>
              <Icon size={13} className={cfg.color} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-700 leading-snug">{event.message}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
              </p>
            </div>
            {idx < events.length - 1 && (
              <div className="absolute left-3.5 mt-7 h-3 w-px bg-slate-100" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
