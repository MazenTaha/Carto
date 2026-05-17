'use client';

import useSWR, { mutate } from 'swr';
import { AdminUser } from '@/types/admin';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useAdminUsers(params: { q?: string; page?: number; pageSize?: number } = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));

  const key = `/api/admin/users?${search.toString()}`;

  const { data, error, isLoading } = useSWR<{
    success: boolean;
    data: AdminUser[];
    total: number;
  }>(key, fetcher);

  async function disableUser(userId: string) {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: 'disable' }),
    });
    await mutate(key);
  }

  return {
    users: data?.data ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    disableUser,
  };
}
