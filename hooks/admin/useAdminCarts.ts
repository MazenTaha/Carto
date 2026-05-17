'use client';

import useSWR, { mutate } from 'swr';
import { AdminCart } from '@/types/admin';

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const KEY = '/api/admin/carts';

export function useAdminCarts() {
  const { data, error, isLoading } = useSWR<{ success: boolean; data: AdminCart[] }>(KEY, fetcher, {
    refreshInterval: 10_000,
  });

  async function resetCart(cartId: string) {
    await fetch(`/api/admin/carts/${cartId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset' }),
    });
    await mutate(KEY);
  }

  async function setStatus(cartId: string, status: string) {
    await fetch(`/api/admin/carts/${cartId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_status', status }),
    });
    await mutate(KEY);
  }

  async function generateQR(cartId: string) {
    const res = await fetch(`/api/admin/carts/${cartId}`, { method: 'POST' });
    return res.json();
  }

  return {
    carts: data?.data ?? [],
    isLoading,
    error,
    resetCart,
    setStatus,
    generateQR,
  };
}
