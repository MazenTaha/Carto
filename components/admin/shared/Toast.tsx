'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleCheck } from 'lucide-react';

/** Small transient confirmation used after admin mutations. */
export function useToast(duration = 3000) {
  const [message, setMessage] = useState('');
  const timer = useRef<number | null>(null);

  const show = useCallback(
    (next: string) => {
      setMessage(next);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setMessage(''), duration);
    },
    [duration]
  );

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  return { message, show };
}

export function Toast({ message }: { message: string }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-6 z-[110] flex justify-center sm:inset-x-auto sm:right-6">
      {message && (
        <div className="flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-medium text-white shadow-overlay animate-rise-in">
          <CircleCheck className="size-4 text-emerald-400" aria-hidden="true" />
          {message}
        </div>
      )}
    </div>
  );
}
