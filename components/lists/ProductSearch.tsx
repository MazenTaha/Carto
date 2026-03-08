
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
        <div className="w-full overflow-hidden">
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-bold text-white tracking-tight uppercase tracking-widest">Find Products</h3>
                    <p className="text-gray-500 text-xs font-bold uppercase mt-1">Search or choose from popular items</p>
                </div>
                <button onClick={onCancel} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="relative mb-8">
                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="e.g milk, apples, coffee..."
                    className="w-full pl-14 pr-14 py-5 bg-gray-900/50 border-2 border-gray-700/50 text-white rounded-[1.5rem] focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-lg placeholder:text-gray-700"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                {isLoading && (
                    <div className="absolute right-5 top-1/2 -translate-y-1/2">
                        <div className="w-6 h-6 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                    </div>
                )}
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar -mx-2 px-2">
                {showPopular && (
                    <div className="mb-4">
                        <div className="flex gap-6 border-b border-gray-700/50 mb-6">
                            <button className="text-xs font-black uppercase tracking-widest text-blue-500 border-b-2 border-blue-500 pb-3">Popular</button>
                            <button className="text-xs font-black uppercase tracking-widest text-gray-500 pb-3 hover:text-gray-300 transition-colors">Recent</button>
                            <button className="text-xs font-black uppercase tracking-widest text-gray-500 pb-3 hover:text-gray-300 transition-colors">Favorites</button>
                        </div>
                    </div>
                )}

                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 transition-opacity duration-200 ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
                    {results.length > 0 ? (
                        results.map((product) => (
                            <button
                                key={product.id}
                                onClick={() => onSelect(product)}
                                className="group flex items-center justify-between p-4 bg-white/5 hover:bg-blue-600 rounded-2xl border border-transparent hover:border-blue-400/30 transition-all text-left shadow-lg hover:shadow-blue-600/20"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 flex items-center justify-center bg-gray-800 rounded-xl text-2xl group-hover:bg-white/20 transition-colors shadow-inner">
                                        {product.emoji || '📦'}
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-100 group-hover:text-white transition-colors">{product.name}</div>
                                        <div className="text-[10px] font-bold text-gray-500 group-hover:text-blue-100/70 uppercase tracking-widest mt-0.5">{product.category}</div>
                                    </div>
                                </div>
                                <div className="w-8 h-8 bg-white/5 group-hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
                                    <svg className="w-4 h-4 text-gray-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                                    </svg>
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="col-span-full py-12 text-center">
                            <div className="w-20 h-20 bg-gray-700/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <p className="text-gray-400 font-medium mb-6">No matching products found.</p>
                            <button
                                className="px-6 py-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 font-bold rounded-xl border border-blue-500/20 transition-all active:scale-95"
                                onClick={() => onSelect({ id: 'custom', name: query, category: 'Other', emoji: '📦', price: 0 })}
                            >
                                ADD "{query.toUpperCase()}" ANYWAY
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
