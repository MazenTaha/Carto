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
  initialItems: ListItem[];
}

export function ListItemsManager({ listId, initialItems }: ListItemsManagerProps) {
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
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-lg flex items-center gap-3 transition-colors shadow-lg"
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
          <span>Add products</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quantity Selection Modal Overlay */}
      {showQuantityModal && pendingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 w-full max-w-sm transform transition-all scale-100">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span>{pendingProduct.emoji || '📦'}</span>
              <span>{pendingProduct.name}</span>
            </h3>

            <div className="mb-6">
              <label className="block text-gray-400 text-sm font-medium mb-2">
                Select Quantity
              </label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setQuantityInput(Math.max(1, quantityInput - 1))}
                  className="w-10 h-10 rounded-full bg-gray-700 text-white hover:bg-gray-600 flex items-center justify-center text-xl font-bold"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(parseInt(e.target.value) || 1)}
                  className="flex-1 bg-gray-900 border border-gray-700 text-white text-center rounded-lg py-2 font-bold text-lg focus:ring-2 focus:ring-blue-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={() => setQuantityInput(quantityInput + 1)}
                  className="w-10 h-10 rounded-full bg-gray-700 text-white hover:bg-gray-600 flex items-center justify-center text-xl font-bold"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowQuantityModal(false);
                  setPendingProduct(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmAddItem}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Add to List
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddForm && (
        <div className="bg-gray-700 rounded-lg p-6 mb-6">
          {error && (
            <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          <ProductSearch
            onSelect={onProductSelect}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {!showAddForm && (
        <button
          onClick={handleAddClick}
          className="mb-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center gap-2 transition-colors"
        >
          <svg
            className="w-5 h-5"
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
          <span>Add products</span>
        </button>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex items-center justify-between p-4 rounded-lg border ${item.isCollected
              ? 'bg-gray-700 border-gray-600 opacity-60'
              : 'bg-gray-700 border-gray-600'
              }`}
          >
            <div className="flex items-center space-x-4 flex-1">
              <input
                type="checkbox"
                checked={item.isCollected}
                onChange={() => handleToggleCollected(item.id, item.isCollected)}
                className="w-5 h-5 text-blue-600 rounded bg-gray-600 border-gray-500 focus:ring-blue-500"
              />
              <div className="flex-1">
                <span
                  className={`text-lg ${item.isCollected
                    ? 'line-through text-gray-400'
                    : 'text-white'
                    }`}
                >
                  {item.name}
                </span>
                <div className="text-sm text-gray-400 mt-1">
                  Quantity: {item.quantity}
                  {item.category && ` • ${item.category}`}
                </div>
              </div>
            </div>
            <button
              onClick={() => handleDeleteItem(item.id)}
              className="text-red-400 hover:text-red-300 transition-colors p-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

