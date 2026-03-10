'use client';

import { useState, useEffect } from 'react';
import { ListItem } from '@/types';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { ProductSearch } from '@/components/lists/ProductSearch';
import { EditableListTitle } from '@/components/lists/EditableListTitle';
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
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);

  const fetchItems = async () => {
    try {
      const response = await fetch(`/api/lists/${listId}/items`);
      const data = await response.json();
      if (data.success) {
        setItems(data.data);
      }
    } catch (err) {}
  };

  const handleAddItem = async (name: string, category?: string | null) => {
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
          category: category || undefined,
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
  const hasItems = items.length > 0;

  return (
    <>
      {/* Mobile (keeps current app style) */}
      <div className="md:hidden">
        <PageContainer className="bg-white dark:bg-background-dark">
          <Header
            title={listName}
            showBack={true}
            rightElement={
              <button className="flex cursor-pointer items-center justify-center rounded-lg h-10 w-10 bg-transparent text-slate-900 dark:text-slate-100 transition-transform active:scale-95">
                <span className="material-symbols-outlined">more_vert</span>
              </button>
            }
          />

          <div className="px-4 py-3 sticky top-14 bg-white dark:bg-background-dark z-10">
            <div className="flex w-full items-stretch rounded-xl h-12 shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <button
                type="button"
                onClick={() => setIsProductSearchOpen(true)}
                className="text-primary flex bg-slate-50 dark:bg-slate-900 items-center justify-center px-4 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Open product search"
              >
                <span className="material-symbols-outlined">search</span>
              </button>
              <input
                className="flex w-full min-w-0 flex-1 border-none bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-0 placeholder:text-slate-400 text-base font-normal leading-normal px-2"
                placeholder="Quick add… (Enter)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddItem(searchTerm)}
              />
              <button
                onClick={() => handleAddItem(searchTerm)}
                disabled={isLoading}
                className="bg-primary text-white px-4 flex items-center justify-center transition-transform transition-colors hover:bg-primary/90 active:scale-95 disabled:opacity-50"
                aria-label="Add item"
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
                            className="text-primary flex h-6 w-6 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-transform transition-colors active:scale-95"
                            aria-label="Decrease quantity"
                          >
                            <span className="material-symbols-outlined text-sm">remove</span>
                          </button>
                          <span className="text-slate-900 dark:text-slate-100 text-sm font-bold w-6 text-center">{item.quantity}</span>
                          <button
                            onClick={() => handleUpdateQuantity(item, 1)}
                            className="text-primary flex h-6 w-6 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-transform transition-colors active:scale-95"
                            aria-label="Increase quantity"
                          >
                            <span className="material-symbols-outlined text-sm">add</span>
                          </button>
                        </div>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-slate-400 hover:text-red-500 transition-transform transition-colors active:scale-95"
                          aria-label="Delete item"
                        >
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
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-slate-400 transition-transform active:scale-95"
                          aria-label="Delete item"
                        >
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
      </div>

      {/* Desktop (website layout) */}
      <div className="hidden md:flex min-h-screen bg-gray-800">
        <Sidebar />
        <main className="flex-1 md:ml-64 min-h-screen">
          <div className="border-b border-gray-700 px-10 py-8">
            <div className="flex items-center justify-between gap-6">
              <EditableListTitle initialName={listName} listId={listId} />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsProductSearchOpen(true)}
                  className="h-10 w-10 rounded-xl border border-gray-700 bg-gray-900/40 text-gray-200 hover:bg-gray-900/70 transition-transform transition-colors active:scale-95"
                  aria-label="Search products"
                >
                  <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="h-10 w-10 rounded-xl border border-gray-700 bg-gray-900/40 text-gray-200 hover:bg-gray-900/70 transition-transform transition-colors active:scale-95"
                  aria-label="More options"
                >
                  <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="px-10 py-10">
            {!hasItems ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="mb-8">
                  <svg className="w-56 h-56 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-white mb-3">What do you need to buy?</h2>
                <p className="text-gray-400 text-lg mb-8">Start searching products to add them to your list</p>
                <button
                  type="button"
                  onClick={() => setIsProductSearchOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-lg flex items-center gap-3 transition-transform transition-colors shadow-lg active:scale-95"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add products</span>
                </button>
              </div>
            ) : (
              <div className="max-w-4xl">
                {/* simple list rendering using existing sections */}
                <div className="mb-8 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setIsProductSearchOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center gap-2 transition-transform transition-colors active:scale-95"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add products</span>
                  </button>
                </div>

                {notCollected.length > 0 && (
                  <div className="mb-10">
                    <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">
                      Not collected ({notCollected.length})
                    </div>
                    <div className="space-y-2">
                      {notCollected.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-gray-900/40 border border-gray-700">
                          <div className="flex items-center gap-4 min-w-0">
                            <input
                              type="checkbox"
                              checked={item.isCollected}
                              onChange={() => handleToggleCollected(item)}
                              className="w-5 h-5 rounded bg-gray-800 border-gray-600"
                            />
                            <div className="min-w-0">
                              <div className="text-white font-semibold truncate">{item.name}</div>
                              <div className="text-xs text-gray-400 truncate">{item.category || 'General'}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="flex items-center bg-gray-800 rounded-full px-2 py-1">
                              <button
                                onClick={() => handleUpdateQuantity(item, -1)}
                                className="text-white/80 hover:text-white h-7 w-7 rounded-full hover:bg-gray-700 transition-transform transition-colors active:scale-95"
                                aria-label="Decrease quantity"
                              >
                                −
                              </button>
                              <span className="text-white font-bold w-8 text-center">{item.quantity}</span>
                              <button
                                onClick={() => handleUpdateQuantity(item, 1)}
                                className="text-white/80 hover:text-white h-7 w-7 rounded-full hover:bg-gray-700 transition-transform transition-colors active:scale-95"
                                aria-label="Increase quantity"
                              >
                                +
                              </button>
                            </div>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="text-red-300 hover:text-red-200 transition-transform active:scale-95"
                              aria-label="Delete item"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {collected.length > 0 && (
                  <div className="opacity-70">
                    <div className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4">
                      Collected ({collected.length})
                    </div>
                    <div className="space-y-2">
                      {collected.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-gray-900/20 border border-gray-800">
                          <div className="flex items-center gap-4 min-w-0">
                            <input
                              type="checkbox"
                              checked={item.isCollected}
                              onChange={() => handleToggleCollected(item)}
                              className="w-5 h-5 rounded bg-gray-800 border-gray-700"
                            />
                            <div className="min-w-0">
                              <div className="text-gray-300 font-semibold truncate line-through">{item.name}</div>
                              <div className="text-xs text-gray-500 truncate">{item.category || 'General'}</div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="text-gray-500 hover:text-red-200 transition-transform active:scale-95"
                            aria-label="Delete item"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Product search modal (works for both layouts) */}
      {isProductSearchOpen && (
        <div className="fixed inset-0 z-50">
          <button
            className="absolute inset-0 bg-black/60"
            aria-label="Close product search"
            onClick={() => setIsProductSearchOpen(false)}
          />
          <div className="absolute inset-x-0 top-10 mx-auto w-[min(920px,calc(100%-2rem))] rounded-3xl border border-gray-700 bg-gray-950/95 backdrop-blur-xl p-8 shadow-2xl">
            <ProductSearch
              onCancel={() => setIsProductSearchOpen(false)}
              onSelect={async (p) => {
                await handleAddItem(p.name, p.category);
                setIsProductSearchOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
