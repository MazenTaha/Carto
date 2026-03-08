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
          className="text-3xl font-semibold text-white bg-transparent border-b-2 border-green-500 focus:outline-none pb-2 w-full"
        />
      ) : (
        <h1
          onClick={() => setIsEditing(true)}
          className="text-3xl font-semibold text-white border-b-2 border-transparent hover:border-gray-600 pb-2 inline-block min-w-[200px] cursor-text"
        >
          {name}
        </h1>
      )}
    </div>
  );
}

