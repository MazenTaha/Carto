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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {localLists.map((list) => (
                <Card key={list.id} className="hover:shadow-lg transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">{list.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm text-gray-500">{list._count.items} items</span>
                                {list.isActive && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                        • Active
                                    </span>
                                )}
                            </div>
                        </div>
                        {/* Delete Icon */}
                        <button
                            onClick={() => handleDeleteClick(list.id, list.name)}
                            className={`transition-colors ${deletingId === list.id
                                ? 'text-red-600 hover:text-red-700'
                                : 'text-gray-400 hover:text-red-500'
                                }`}
                            title={deletingId === list.id ? (confirmCount === 0 ? 'Click again to confirm' : 'Click once more to delete') : 'Delete list'}
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

                    {/* Confirmation message */}
                    {deletingId === list.id && (
                        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm">
                            <p className="text-red-800 font-medium">
                                {confirmCount === 0 ? (
                                    <>Click delete icon again to confirm</>
                                ) : (
                                    <>Click delete icon once more to permanently delete "{list.name}"</>
                                )}
                            </p>
                            <button
                                onClick={handleCancelDelete}
                                className="text-red-600 hover:text-red-700 underline mt-1"
                            >
                                Cancel
                            </button>
                        </div>
                    )}

                    <div className="flex flex-col gap-3">
                        <Button
                            onClick={() => handleActivateList(list.id)}
                            className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white border-0"
                            size="sm"
                            disabled={loadingId !== null}
                        >
                            {loadingId === list.id ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Activating...
                                </span>
                            ) : (
                                'Activate List'
                            )}
                        </Button>
                        <Link href={`/lists/${list.id}`} className="w-full">
                            <Button variant="outline" className="w-full" size="sm">
                                View
                            </Button>
                        </Link>
                    </div>
                </Card>
            ))}
        </div>
    );
}
