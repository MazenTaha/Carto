'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { createListSchema } from '@/lib/validations';

function readApiErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === 'object' && payload !== null) {
    const data = payload as { error?: string | { message?: string } };

    if (typeof data.error === 'string') {
      return data.error;
    }

    if (typeof data.error?.message === 'string') {
      return data.error.message;
    }
  }

  return fallback;
}

export function NewListNamePageClient() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    try {
      createListSchema.parse({ name: name.trim() });
    } catch (err: any) {
      setError(err?.errors?.[0]?.message || err?.message || 'Please enter a list name.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/lists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success || !payload?.data?.id) {
        throw new Error(readApiErrorMessage(payload, 'Could not create draft list.'));
      }

      router.push(`/lists/${payload.data.id}`);
    } catch (err: any) {
      setError(err.message || 'Could not create draft list.');
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-soft">
        <div className="bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.16),_transparent_42%)] p-6 sm:p-8">
          <Badge className="bg-white/10 text-white ring-white/15">Step 1 of 2</Badge>
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Name your list</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/72 sm:text-base">
            Start with a name, then continue to the list editor to add products and quantities.
          </p>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">List name</span>
          <input
            type="text"
            name="name"
            autoFocus
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g., Weekly groceries"
            className="mt-3 h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-3 pb-1 sm:grid-cols-2">
          <Button
            type="submit"
            className="h-12 rounded-2xl text-sm font-black shadow-glow"
            disabled={isSubmitting}
          >
            <span className="material-symbols-outlined text-[18px]">
              {isSubmitting ? 'progress_activity' : 'arrow_forward'}
            </span>
            {isSubmitting ? 'Creating...' : 'Continue'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-2xl border-primary/20 bg-white text-sm font-black text-primary shadow-sm hover:border-primary/35 hover:bg-primary/5 dark:bg-slate-900"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
}
