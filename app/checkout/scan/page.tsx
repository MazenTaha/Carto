import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { EmptyState } from '@/components/ui/EmptyState';
import { requireUserOrGuest } from '@/lib/guest-session';
import { ApiErrorResponse } from '@/lib/api-response';
import { PaymentService } from '@/lib/services/payment.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getErrorTitle(code: string) {
  switch (code) {
    case 'PAYMENT_QR_EXPIRED':
      return 'Payment QR expired';
    case 'PAYMENT_ALREADY_COMPLETED':
      return 'Payment already completed';
    case 'SESSION_NOT_ACTIVE':
      return 'Session no longer active';
    case 'INVALID_PAYMENT_QR':
    default:
      return 'Invalid payment QR';
  }
}

function PaymentQrErrorState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <PageContainer maxWidth="md">
      <main className="flex min-h-screen items-center justify-center p-4">
        <EmptyState
          icon="qr_code_2"
          title={title}
          description={description}
          actionLabel="Back to dashboard"
          actionHref="/dashboard"
          className="max-w-md"
        />
      </main>
    </PageContainer>
  );
}

export default async function CheckoutScanPage({
  searchParams,
}: {
  searchParams?: { token?: string };
}) {
  const token = searchParams?.token?.trim() || '';

  if (!token) {
    return (
      <PaymentQrErrorState
        title="Invalid payment QR"
        description="This payment QR is missing its secure token."
      />
    );
  }

  const owner = await requireUserOrGuest();

  if (!owner) {
    return (
      <PageContainer maxWidth="md">
        <main className="flex min-h-screen items-center justify-center p-4">
          <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <h1 className="text-2xl font-black text-slate-950 dark:text-slate-100">Open this QR from your Carto session</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Sign in or continue as guest on the same device that owns this cart session, then scan the payment QR again.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link
                href="/auth/signin"
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-black text-white shadow-glow transition active:scale-[0.98]"
              >
                Sign in
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:border-primary/30 hover:text-primary dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              >
                Back to dashboard
              </Link>
            </div>
          </section>
        </main>
      </PageContainer>
    );
  }

  try {
    const attempt = await PaymentService.getOwnedAttemptByPaymentQrToken(owner, token);
    redirect(`/checkout?sessionId=${encodeURIComponent(attempt.sessionId)}`);
  } catch (error) {
    if (error instanceof ApiErrorResponse) {
      return (
        <PaymentQrErrorState
          title={getErrorTitle(error.code)}
          description={error.message}
        />
      );
    }

    throw error;
  }
}
