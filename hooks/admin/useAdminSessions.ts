'use client';

import useSWR, { mutate } from 'swr';
import { AdminSessionRow } from '@/types/admin';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useAdminSessions(params: { status?: string; page?: number; pageSize?: number } = {}) {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));

  const key = `/api/admin/sessions?${search.toString()}`;

  const { data, error, isLoading } = useSWR<{
    success: boolean;
    data: {
      data: AdminSessionRow[];
      total: number;
      page: number;
      pageSize: number;
    };
  }>(key, fetcher, { refreshInterval: 5_000 });

  async function endSession(sessionId: string) {
    await fetch('/api/admin/sessions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    await mutate(key);
  }

  return {
    sessions: data?.data?.data ?? [],
    total: data?.data?.total ?? 0,
    isLoading,
    error,
    endSession,
  };
}
