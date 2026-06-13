import { redirect } from 'next/navigation';

export default function LegacyCheckoutSuccessPage({
  searchParams,
}: {
  searchParams?: { attemptId?: string; sessionId?: string; receiptId?: string };
}) {
  const params = new URLSearchParams();

  if (searchParams?.attemptId) {
    params.set('attemptId', searchParams.attemptId);
  }

  if (searchParams?.sessionId) {
    params.set('sessionId', searchParams.sessionId);
  }

  if (searchParams?.receiptId) {
    params.set('receiptId', searchParams.receiptId);
  }

  redirect(`/payment/success${params.toString() ? `?${params.toString()}` : ''}`);
}
