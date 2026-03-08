
'use client';

import { useState, useEffect, useRef } from 'react';
import { useDebounce } from '@/lib/hooks'; // We might need to create this hook if it doesn't exist
import { Button } from '@/components/ui/Button';

interface Product {
    id: string;
    name: string;
    category: string;
    emoji: string | null;
    price: number;
}

interface ProductSearchProps {
    onSelect: (product: Product) => void;
    onCancel: () => void;
}

export function ProductSearch({ onSelect, onCancel }: ProductSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showPopular, setShowPopular] = useState(true);
    const inputRef = useRef<HTMLInputElement>(null);

    // Debounce search to avoid too many API calls
    const debouncedQuery = useDebounce(query, 300);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
        // Fetch popular items initially
        fetchProducts('');
    }, []);

    useEffect(() => {
        fetchProducts(debouncedQuery);
    }, [debouncedQuery]);

    const fetchProducts = async (search: string) => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/products?q=${encodeURIComponent(search)}&limit=20`);
            if (res.ok) {
                const data = await res.json();
                setResults(data.data);
                setShowPopular(!search);
            }
        } catch (error) {
            console.error('Failed to fetch products', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                <h3 className="font-semibold text-white">Add products</h3>
                <button onClick={onCancel} className="text-gray-400 hover:text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="p-4 relative">
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="e.g milk"
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium placeholder-gray-500"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                {isLoading && (
                    <div className="absolute right-7 top-1/2 -translate-y-1/2">
                        <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                )}
            </div>

            <div className="max-h-96 overflow-y-auto px-2 pb-2">
                {showPopular && (
                    <div className="px-2 pb-2">
                        <div className="flex gap-4 border-b border-gray-700 mb-2">
                            <button className="text-sm font-medium text-blue-500 border-b-2 border-blue-500 pb-2">Popular</button>
                            <button className="text-sm font-medium text-gray-400 pb-2 hover:text-gray-300">Recent</button>
                        </div>
                    </div>
                )}

                <div className={`space-y-1 transition-opacity duration-200 ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
                    {results.length > 0 ? (
                        results.map((product) => (
                            <button
                                key={product.id}
                                onClick={() => onSelect(product)}
                                className="w-full flex items-center justify-between p-2 hover:bg-gray-700 rounded-md group transition-colors text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-full text-lg group-hover:bg-gray-600 transition-colors">
                                        {product.emoji || '📦'}
                                    </div>
                                    <span className="font-medium text-gray-200 group-hover:text-white">{product.name}</span>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                    </div>
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="p-4 text-center text-gray-400">
                            No products found.
                            <button
                                className="text-blue-500 hover:underline ml-1"
                                onClick={() => onSelect({ id: 'custom', name: query, category: 'Other', emoji: '📦', price: 0 })}
                            >
                                Add "{query}" anyway
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
