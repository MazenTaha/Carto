'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface RecoverListButtonProps {
  listId: string;
  listName: string;
}

export function RecoverListButton({ listId, listName }: RecoverListButtonProps) {
  const router = useRouter();
  const [isRecovering, setIsRecovering] = useState(false);

  const handleRecover = async () => {
    if (isRecovering) {
      return;
    }

    setIsRecovering(true);

    try {
      const response = await fetch(`/api/lists/${listId}/restore`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to recover list');
      }

      router.refresh();
    } catch (error) {
      window.alert(`Could not recover "${listName}". Please try again.`);
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleRecover}
      disabled={isRecovering}
      className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-black text-primary shadow-sm transition hover:bg-primary hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-950/70"
    >
      {isRecovering ? 'Recovering...' : 'Recover'}
    </button>
  );
}
