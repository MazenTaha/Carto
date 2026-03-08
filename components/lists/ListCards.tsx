'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useRouter } from 'next/navigation';

interface ShoppingList {
    id: string;
    name: string;
    isActive: boolean;
    _count: {
        items: number;
    };
}

interface ListCardsProps {
    lists: ShoppingList[];
}

export function ListCards({ lists }: ListCardsProps) {
    const router = useRouter();
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmCount, setConfirmCount] = useState(0);
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [localLists, setLocalLists] = useState<ShoppingList[]>(lists);

    // Keep localLists in sync with props when they change (e.g. after router.refresh())
    useEffect(() => {
        setLocalLists(lists);
    }, [lists]);

    const handleDeleteClick = async (listId: string, listName: string) => {
        if (deletingId === listId) {
            // Second click - actually delete
            if (confirmCount === 1) {
                try {
                    const response = await fetch(`/api/lists/${listId}`, {
                        method: 'DELETE',
                    });

                    if (response.ok) {
                        router.refresh();
                    } else {
                        alert('Failed to delete list');
                    }
                } catch (error) {
                    console.error('Error deleting list:', error);
                    alert('Failed to delete list');
                } finally {
                    setDeletingId(null);
                    setConfirmCount(0);
                }
            } else {
                // First confirmation
                setConfirmCount(1);
            }
        } else {
            // First click - show confirmation
            setDeletingId(listId);
            setConfirmCount(0);
        }
    };

    const handleCancelDelete = () => {
        setDeletingId(null);
        setConfirmCount(0);
    };

    const handleActivateList = async (listId: string) => {
        setLoadingId(listId);

        // Optimistic update
        const previousLists = [...localLists];
        setLocalLists(localLists.map(l => ({
            ...l,
            isActive: l.id === listId
        })));

        try {
            console.log('Activating list:', listId);
            const response = await fetch(`/api/lists/${listId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ isActive: true }),
            });

            const data = await response.json().catch(() => ({}));
            console.log('Activation response:', response.status, data);

            if (response.ok) {
                router.refresh();
                router.push(`/session/start?listId=${listId}`);
            } else {
                setLocalLists(previousLists); // Rollback
                alert(`Failed to activate list: ${data.error || response.statusText}`);
            }
        } catch (error) {
            setLocalLists(previousLists); // Rollback
            console.error('Error activating list:', error);
            alert('Failed to activate list. Please check your connection.');
        } finally {
            setLoadingId(null);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {localLists.map((list) => (
                <div key={list.id} className="group relative bg-gray-800/40 backdrop-blur-sm rounded-[2rem] p-8 border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 shadow-2xl overflow-hidden flex flex-col h-full">
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[80px] -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-all" />

                    <div className="flex justify-between items-start mb-8 relative z-10">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-2xl font-bold text-white tracking-tight group-hover:text-blue-400 transition-colors truncate pr-4">
                                {list.name}
                            </h3>
                            <div className="flex items-center gap-3 mt-3">
                                <span className="text-xs font-mono text-gray-500 bg-black/40 px-3 py-1 rounded-full border border-gray-700/50">
                                    {list._count.items} ITEMS
                                </span>
                                {list.isActive && (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2 animate-pulse" />
                                        Active
                                    </span>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeleteClick(list.id, list.name);
                            }}
                            className={`p-3 rounded-2xl transition-all ${deletingId === list.id
                                ? 'bg-red-500/20 text-red-400 scale-110'
                                : 'text-gray-500 hover:text-red-400 hover:bg-red-500/10'
                                }`}
                            title="Delete list"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>

                    {/* Confirmation UI overlay */}
                    {deletingId === list.id && (
                        <div className="absolute inset-0 z-20 bg-gray-900/90 backdrop-blur-md p-8 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-200">
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h4 className="text-xl font-bold text-white mb-2">Are you sure?</h4>
                            <p className="text-gray-400 text-sm mb-6 max-w-[200px]">
                                {confirmCount === 0
                                    ? "This list will be permanently deleted."
                                    : "Last chance! This cannot be undone."}
                            </p>
                            <div className="flex gap-4 w-full">
                                <button
                                    onClick={handleCancelDelete}
                                    className="flex-1 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDeleteClick(list.id, list.name)}
                                    className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-600/20"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="mt-auto space-y-4 relative z-10">
                        <Button
                            onClick={() => handleActivateList(list.id)}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-emerald-600/20 border-0 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            disabled={loadingId !== null}
                        >
                            {loadingId === list.id ? (
                                <span className="flex items-center justify-center gap-3">
                                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    ACTIVATING...
                                </span>
                            ) : (
                                'START SHOPPING'
                            )}
                        </Button>
                        <Link href={`/lists/${list.id}`} className="block">
                            <button className="w-full py-4 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-bold rounded-2xl border border-gray-700/50 transition-all">
                                VIEW DETAILS
                            </button>
                        </Link>
                    </div>
                </div>
            ))}
        </div>
    );
}
