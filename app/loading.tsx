import { Logo } from '@/components/ui/Logo';
import { Spinner } from '@/components/ui/LoadingState';

export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-canvas px-4">
      <Logo height={30} priority />
      <div className="flex items-center gap-2.5 text-sm font-medium text-ink-muted">
        <Spinner />
        Loading Carto…
      </div>
    </div>
  );
}
