'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { createListSchema } from '@/lib/validations';

const NAME_SUGGESTIONS = ['Weekly groceries', 'Weekend breakfast', 'Party supplies', 'Household restock'];

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
      <PageHeader
        eyebrow={<Badge tone="brand">Step 1 of 2</Badge>}
        title="Name your list"
        description="Give it a name you will recognise at the store. You will add products on the next screen."
      />

      <form onSubmit={handleSubmit} noValidate className="surface-card mt-6 p-5 sm:p-6">
        <Input
          label="List name"
          name="name"
          autoFocus
          autoComplete="off"
          maxLength={100}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (error) setError('');
          }}
          placeholder="e.g. Weekly groceries"
          error={error || undefined}
        />

        <div className="mt-4 flex flex-wrap gap-2" aria-label="Suggestions">
          {NAME_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                setName(suggestion);
                setError('');
              }}
              className="rounded-full border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink-muted transition hover:border-brand-200 hover:bg-brand-50 hover:text-primary"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => router.back()} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Continue to add items'}
            {!isSubmitting && <ArrowRight aria-hidden="true" />}
          </Button>
        </div>
      </form>
    </>
  );
}
