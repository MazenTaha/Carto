'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DeleteListButtonProps {
  listId: string;
  listName: string;
}

export function DeleteListButton({ listId, listName }: DeleteListButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (isDeleting) {
      return;
    }

    const confirmed = window.confirm(`Move "${listName}" to Recently deleted? It will be permanently deleted after 30 days.`);
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/lists/${listId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete list');
      }

      router.refresh();
    } catch (error) {
      window.alert('Could not delete this list. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isDeleting}
      className="flex size-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950/30 dark:hover:text-red-300"
      aria-label={`Delete ${listName}`}
      title="Delete list"
    >
      <span className="material-symbols-outlined text-[21px]">
        {isDeleting ? 'progress_activity' : 'delete'}
      </span>
    </button>
  );
}
