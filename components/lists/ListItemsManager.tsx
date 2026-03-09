'use client';

import { useState, useEffect } from 'react';
import { ListItem } from '@/types';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ListItemsManagerProps {
  listId: string;
  listName: string;
  initialItems: ListItem[];
}

export function ListItemsManager({ listId, listName, initialItems }: ListItemsManagerProps) {
  const [items, setItems] = useState<ListItem[]>(initialItems);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchItems = async () => {
    try {
      const response = await fetch(`/api/lists/${listId}/items`);
      const data = await response.json();
      if (data.success) {
        setItems(data.data);
      }
    } catch (err) {}
  };

  const handleAddItem = async (name: string) => {
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/lists/${listId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          quantity: 1,
          price: 0,
        }),
      });

      if (response.ok) {
        setSearchTerm('');
        await fetchItems();
      }
    } catch (err) {} finally {
      setIsLoading(false);
    }
  };

  const handleUpdateQuantity = async (item: ListItem, delta: number) => {
    const newQuantity = Math.max(1, item.quantity + delta);
    if (newQuantity === item.quantity) return;

    try {
      await fetch(`/api/lists/${listId}/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: newQuantity }),
      });
      fetchItems();
    } catch (err) {}
  };

  const handleToggleCollected = async (item: ListItem) => {
    try {
      await fetch(`/api/lists/${listId}/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCollected: !item.isCollected }),
      });
      fetchItems();
    } catch (err) {}
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await fetch(`/api/lists/${listId}/items/${itemId}`, {
        method: 'DELETE',
      });
      fetchItems();
    } catch (err) {}
  };

  const notCollected = items.filter(i => !i.isCollected);
  const collected = items.filter(i => i.isCollected);

  return (
    <PageContainer className="bg-white dark:bg-background-dark">
      <Header
        title={listName}
        showBack={true}
        rightElement={
          <button className="flex cursor-pointer items-center justify-center rounded-lg h-10 w-10 bg-transparent text-slate-900 dark:text-slate-100">
            <span className="material-symbols-outlined">more_vert</span>
          </button>
        }
      />

      <div className="px-4 py-3 sticky top-14 bg-white dark:bg-background-dark z-10">
        <div className="flex w-full items-stretch rounded-xl h-12 shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="text-primary flex bg-slate-50 dark:bg-slate-900 items-center justify-center px-4">
            <span className="material-symbols-outlined">search</span>
          </div>
          <input
            className="flex w-full min-w-0 flex-1 border-none bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-0 placeholder:text-slate-400 text-base font-normal leading-normal px-2"
            placeholder="Search or add product"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddItem(searchTerm)}
          />
          <button
            onClick={() => handleAddItem(searchTerm)}
            disabled={isLoading}
            className="bg-primary text-white px-4 flex items-center justify-center transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <span className="material-symbols-outlined">add</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-32">
        {notCollected.length > 0 && (
          <>
            <div className="flex items-center justify-between pb-2 pt-4">
              <h3 className="text-slate-900 dark:text-slate-100 text-sm font-bold uppercase tracking-wider">Not Collected ({notCollected.length})</h3>
              <span className="text-primary text-xs font-semibold cursor-pointer">Clear all</span>
            </div>
            <div className="space-y-2">
              {notCollected.map(item => (
                <div key={item.id} className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center justify-center">
                    <input
                      className="h-6 w-6 rounded-full border-slate-300 dark:border-slate-600 border-2 bg-transparent text-primary checked:bg-primary checked:border-primary focus:ring-0 focus:ring-offset-0"
                      type="checkbox"
                      checked={item.isCollected}
                      onChange={() => handleToggleCollected(item)}
                    />
                  </div>
                  <div className="flex flex-col flex-1">
                    <p className="text-slate-900 dark:text-slate-100 text-base font-medium leading-tight">{item.name}</p>
                    <p className="text-slate-500 dark:text-slate-400 text-xs">
                      {item.category || 'General'} {item.price ? `• $${item.price.toFixed(2)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-full px-2 py-1">
                      <button
                        onClick={() => handleUpdateQuantity(item, -1)}
                        className="text-primary flex h-6 w-6 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">remove</span>
                      </button>
                      <span className="text-slate-900 dark:text-slate-100 text-sm font-bold w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => handleUpdateQuantity(item, 1)}
                        className="text-primary flex h-6 w-6 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                      </button>
                    </div>
                    <button onClick={() => handleDeleteItem(item.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {collected.length > 0 && (
          <>
            <div className="flex items-center justify-between pb-2 pt-8">
              <h3 className="text-slate-400 dark:text-slate-500 text-sm font-bold uppercase tracking-wider">Collected ({collected.length})</h3>
            </div>
            <div className="space-y-2 opacity-60">
              {collected.map(item => (
                <div key={item.id} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-center">
                    <input
                      checked={item.isCollected}
                      onChange={() => handleToggleCollected(item)}
                      className="h-6 w-6 rounded-full border-primary border-2 bg-primary text-white checked:bg-primary checked:border-primary focus:ring-0 focus:ring-offset-0"
                      type="checkbox"
                    />
                  </div>
                  <div className="flex flex-col flex-1">
                    <p className="text-slate-500 dark:text-slate-400 text-base font-medium leading-tight line-through">{item.name}</p>
                    <p className="text-slate-400 dark:text-slate-500 text-xs">{item.category || 'General'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-slate-200 dark:bg-slate-800 rounded-full px-3 py-1 text-xs font-bold text-slate-500">
                      {item.quantity} {item.quantity > 1 ? 'items' : 'item'}
                    </div>
                    <button onClick={() => handleDeleteItem(item.id)} className="text-slate-400">
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </PageContainer>
  );
}
