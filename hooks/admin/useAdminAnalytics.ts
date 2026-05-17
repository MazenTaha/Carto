'use client';

import useSWR from 'swr';
import { AnalyticsData } from '@/types/admin';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useAdminAnalytics() {
  const { data, error, isLoading } = useSWR<{ success: boolean; data: AnalyticsData }>(
    '/api/admin/analytics',
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    analytics: data?.data ?? null,
    isLoading,
    error,
  };
}
