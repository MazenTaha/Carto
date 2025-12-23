// Component for managing list items

'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { createListItemSchema } from '@/lib/validations';
import { ListItem } from '@/types';
import { ProductSearch } from './ProductSearch';

interface ListItemsManagerProps {
  listId: string;
  listName: string;
  initialItems: ListItem[];
}

export function ListItemsManager({ listId, listName, initialItems }: ListItemsManagerProps) {
  const [items, setItems] = useState<ListItem[]>(initialItems);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newItemCategory, setNewItemCategory] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // State for quantity selection modal
  const [pendingProduct, setPendingProduct] = useState<{
    name: string;
    category?: string;
    emoji?: string;
  } | null>(null);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [quantityInput, setQuantityInput] = useState(1);

  const fetchItems = async () => {
    try {
      const response = await fetch(`/api/lists/${listId}/items`);
      const data = await response.json();
      if (data.success) {
        setItems(data.data);
      }
    } catch (err) {
      console.error('Error fetching items:', err);
    }
  };

  const onProductSelect = (productOrName: any) => {
    let name = '';
    let category = '';
    let emoji = '';

    if (typeof productOrName === 'string') {
      name = productOrName;
    } else {
      name = productOrName.name;
      category = productOrName.category;
      emoji = productOrName.emoji;
    }

    // Check for duplicates
    const isDuplicate = items.some(
      (item) => item.name.toLowerCase() === name.toLowerCase()
    );

    if (isDuplicate) {
      alert(`"${name}" is already in your list!`);
      return;
    }

    setPendingProduct({ name, category, emoji });
    setQuantityInput(1);
    setShowQuantityModal(true);
  };

  const confirmAddItem = async () => {
    if (!pendingProduct) return;

    await handleAddItem(pendingProduct, quantityInput);

    // Reset modal state
    setShowQuantityModal(false);
    setPendingProduct(null);
    setQuantityInput(1);
    // Hide search form after successful add
    setShowAddForm(false);
  };

  const handleAddItem = async (productDetails: any, quantity: number) => {
    setError('');
    setIsLoading(true);

    const { name, category, emoji } = productDetails;

    console.log('[CLIENT DEBUG] Adding item to list:', {
      listId,
      productName: name,
      category,
      quantity,
    });

    try {
      createListItemSchema.parse({
        name,
        quantity,
        category: category || undefined,
      });

      const apiUrl = `/api/lists/${listId}/items`;
      console.log('[CLIENT DEBUG] Making POST request to:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          quantity,
          category: category || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[CLIENT DEBUG] API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          data,
        });
        throw new Error(data.error || 'Failed to add item');
      }

      console.log('[CLIENT DEBUG] Item added successfully:', data);

      await fetchItems();
      return true;
    } catch (err: any) {
      console.error('[CLIENT DEBUG] Error in handleAddItem:', err);
      setError(err.message || 'An error occurred');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleCollected = async (itemId: string, isCollected: boolean) => {
    try {
      const response = await fetch(`/api/lists/${listId}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCollected: !isCollected }),
      });

      if (response.ok) {
        fetchItems();
      }
    } catch (err) {
      console.error('Error updating item:', err);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const response = await fetch(`/api/lists/${listId}/items/${itemId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchItems();
      }
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  const handleAddClick = () => {
    setShowAddForm(true);
  };

  if (items.length === 0 && !showAddForm) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        {/* Central Illustration - Shopping Cart Icon */}
        <div className="mb-8">
          <svg
            className="w-48 h-48 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        </div>

        {/* Main Text */}
        <h2 className="text-3xl font-bold text-white mb-4">
          What do you need to buy?
        </h2>

        {/* Subtext */}
        <p className="text-gray-400 text-lg mb-8">
          Start searching products to add them to your list
        </p>

        {/* Add Products Button */}
        <button
          onClick={handleAddClick}
          className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-xl flex items-center gap-3 transition-all shadow-2xl hover:scale-105 active:scale-95 z-40"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          <span className="text-lg">Add products</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative pb-24">
      {/* Search Modal Overlay */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-2xl border border-gray-700 shadow-2xl">
            {error && (
              <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4">
                {error}
              </div>
            )}
            <ProductSearch
              onSelect={onProductSelect}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        </div>
      )}

      {/* Main Floating Card */}
      <div className="bg-gray-800/40 backdrop-blur-sm rounded-3xl border border-gray-700/50 shadow-2xl overflow-hidden">
        {/* Card Header */}
        <div className="px-8 py-6 border-b border-gray-700/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4 flex-1">
              <a
                href="/lists"
                className="text-gray-400 hover:text-white transition-colors p-1"
                title="Back to lists"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </a>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                {listName}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </button>
              <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>
          </div>
          <div className="h-0.5 w-full bg-gray-700/30 rounded-full" />
        </div>

        {/* Items List */}
        <div className="p-6 space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {items.map((item) => (
            <div
              key={item.id}
              className="group flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-all cursor-pointer border border-transparent hover:border-gray-700/30"
              onClick={() => handleToggleCollected(item.id, item.isCollected)}
            >
              <div className="flex items-center gap-5 flex-1">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${item.isCollected
                  ? 'border-blue-500 bg-blue-500'
                  : 'border-gray-600 group-hover:border-gray-400'
                  }`}>
                  {item.isCollected && (
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <span className={`text-xl font-medium transition-all ${item.isCollected ? 'text-gray-500 line-through' : 'text-gray-100'
                    }`}>
                    {item.name}
                  </span>
                  {item.quantity > 1 && (
                    <span className="ml-3 text-sm text-gray-500 font-mono">
                      x{item.quantity}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-gray-500 font-mono text-lg">0 $</span>
                <span className="text-2xl opacity-80">{item.category?.includes('fruit') ? '🍎' : '📦'}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteItem(item.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 p-2 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Card Footer Summary */}
        <div className="px-8 py-6 bg-gray-900/40 border-t border-gray-700/50 flex items-center justify-between">
          <div className="flex gap-10">
            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Unchecked</div>
              <div className="text-xl font-bold text-gray-200">0.00 $</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Checked</div>
              <div className="text-xl font-bold text-gray-200">0.00 $</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total</div>
              <div className="text-xl font-bold text-white">0.00 $</div>
            </div>
          </div>
          <button className="p-2 text-gray-500 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Centered Floating Add Button */}
      {!showAddForm && (
        <button
          onClick={handleAddClick}
          className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-xl flex items-center gap-3 transition-all shadow-2xl hover:scale-105 active:scale-95 z-40 border border-blue-500/50"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-lg">Add products</span>
        </button>
      )}

      {/* Quantity Modal Overlay stays original but with better styling */}
      {showQuantityModal && pendingProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="bg-slate-900 p-8 rounded-[2rem] shadow-2xl border border-gray-700/50 w-full max-w-sm transform animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-4">
              <span className="text-4xl drop-shadow-lg">{pendingProduct.emoji || '📦'}</span>
              <span className="truncate">{pendingProduct.name}</span>
            </h3>

            <div className="mb-10">
              <label className="block text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-4 text-center">
                Select Quantity
              </label>
              <div className="flex items-center justify-center gap-6 bg-gray-800/50 rounded-2xl p-4 border border-gray-700/30 max-w-[280px] mx-auto">
                <button
                  onClick={() => setQuantityInput(Math.max(1, quantityInput - 1))}
                  className="w-12 h-12 shrink-0 rounded-xl bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center text-3xl font-light transition-all active:scale-90 shadow-lg"
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(parseInt(e.target.value) || 1)}
                  className="w-16 bg-transparent text-white text-center font-bold text-4xl focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={() => setQuantityInput(quantityInput + 1)}
                  className="w-12 h-12 shrink-0 rounded-xl bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center text-3xl font-light transition-all active:scale-90 shadow-lg"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowQuantityModal(false);
                  setPendingProduct(null);
                }}
                className="flex-1 px-6 py-4 bg-gray-800/80 text-gray-300 rounded-2xl hover:bg-gray-800 hover:text-white font-bold transition-all border border-gray-700/50"
              >
                Cancel
              </button>
              <button
                onClick={confirmAddItem}
                className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-500 font-bold transition-all shadow-xl shadow-blue-500/20 active:scale-95"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

