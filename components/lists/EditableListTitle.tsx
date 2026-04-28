'use client';

import { useState, useRef, useEffect } from 'react';

interface EditableListTitleProps {
  initialName: string;
  listId: string;
  onUpdate?: (name: string) => void;
}

export function EditableListTitle({
  initialName,
  listId,
  onUpdate,
}: EditableListTitleProps) {
  const [name, setName] = useState(initialName);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = async () => {
    setIsEditing(false);
    if (name.trim() && name !== initialName) {
      try {
        const response = await fetch(`/api/lists/${listId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim() }),
        });

        if (response.ok) {
          onUpdate?.(name.trim());
        } else {
          // Revert on error
          setName(initialName);
        }
      } catch (error) {
        // Revert on error
        setName(initialName);
      }
    } else if (!name.trim()) {
      setName(initialName);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setName(initialName);
      setIsEditing(false);
    }
  };

  return (
    <div className="flex-1">
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full border-b-2 border-primary bg-transparent pb-2 text-3xl font-black text-slate-950 outline-none dark:text-slate-100"
        />
      ) : (
        <h1
          onClick={() => setIsEditing(true)}
          className="inline-block min-w-[200px] cursor-text border-b-2 border-transparent pb-2 text-3xl font-black text-slate-950 hover:border-primary/40 dark:text-slate-100"
        >
          {name}
        </h1>
      )}
    </div>
  );
}

