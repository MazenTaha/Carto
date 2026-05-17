'use client';

import useSWR, { mutate } from 'swr';
import { AdminProduct, AdminProductsResponse } from '@/types/admin';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useAdminProducts(params: {
  q?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}) {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.category) search.set('category', params.category);
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));

  const key = `/api/admin/products?${search.toString()}`;
  const { data, error, isLoading } = useSWR<{ success: boolean } & AdminProductsResponse>(key, fetcher);

  async function createProduct(input: Omit<AdminProduct, 'id' | 'createdAt' | 'updatedAt'>) {
    const res = await fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    await mutate(key);
    return res.json();
  }

  async function updateProduct(input: Partial<AdminProduct> & { id: string }) {
    const res = await fetch('/api/admin/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    await mutate(key);
    return res.json();
  }

  async function deleteProduct(id: string) {
    const res = await fetch(`/api/admin/products?id=${id}`, { method: 'DELETE' });
    await mutate(key);
    return res.json();
  }

  return {
    products: data?.data ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    pageSize: data?.pageSize ?? 20,
    isLoading,
    error,
    createProduct,
    updateProduct,
    deleteProduct,
  };
}
