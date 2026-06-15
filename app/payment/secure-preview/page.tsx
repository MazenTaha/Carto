import { notFound } from 'next/navigation';
import { SecurePreviewActions } from '@/components/payment/SecurePreviewActions';
import { PageContainer } from '@/components/layout/PageContainer';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { requireUserOrGuest } from '@/lib/guest-session';
import { centsToAmount, formatPaymentCurrency } from '@/lib/payment-money';
import { PaymentService } from '@/lib/services/payment.service';

function getAttemptMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  return metadata as Record<string, unknown>;
}

function formatPreviewStatus(status: string, paymentStatus: string, receiptStatus: string, isPreviewMode: boolean) {
  if (receiptStatus === 'PAID' || paymentStatus === 'COMPLETED' || status === 'SUCCEEDED') {
    return 'PAID';
  }

  if (isPreviewMode && status === 'PENDING') {
    return 'Preview / Pending';
  }

  if (status === 'PROCESSING') {
    return 'REDIRECTED';
  }

  if (status === 'FAILED') {
    return 'FAILED';
  }

  if (status === 'CANCELLED') {
    return 'CANCELLED';
  }

  if (status === 'EXPIRED') {
    return 'EXPIRED';
  }

  return 'PENDING';
}

function shortId(value: string) {
  return value.slice(-6).toUpperCase();
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SecurePaymentPreviewPage({
  searchParams,
}: {
  searchParams?: { attemptId?: string };
}) {
  const attemptId = searchParams?.attemptId?.trim();

  if (!attemptId) {
    return (
      <PageContainer maxWidth="md">
        <main className="flex min-h-screen items-center justify-center p-4">
          <EmptyState
            icon="lock"
            title="Payment preview unavailable"
            description="Missing payment attempt ID."
            actionLabel="Back to dashboard"
            actionHref="/dashboard"
            className="max-w-md"
          />
        </main>
      </PageContainer>
    );
  }

  const owner = await requireUserOrGuest();

  if (!owner) {
    notFound();
  }

  const attempt = await PaymentService.getOwnedAttempt(owner, attemptId);

  if (!attempt || !attempt.receipt) {
    notFound();
  }

  const attemptMetadata = getAttemptMetadata(attempt.metadata);
  const previewReason = typeof attemptMetadata.previewReason === 'string' ? attemptMetadata.previewReason : null;
  const isPreviewMode = Boolean(attempt.checkoutUrl?.startsWith('/'));
  const previewStatus = formatPreviewStatus(
    attempt.status,
    attempt.receipt.paymentStatus,
    attempt.receipt.status,
    isPreviewMode,
  );
  const amountLabel = formatPaymentCurrency(centsToAmount(attempt.amountCents), attempt.currency);
  const returnHref = `/session/ready?sessionId=${encodeURIComponent(attempt.sessionId)}`;
  const isMissingPaymobConfig = previewReason === 'PAYMOB_NOT_CONFIGURED';

  return (
    <PageContainer maxWidth="md">
      <main className="flex min-h-screen items-center justify-center p-4">
        <section className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900 md:p-8">
          <Badge className="bg-primary/10 text-primary ring-primary/10">
            {isMissingPaymobConfig ? 'Paymob configuration required' : 'Secure payment preview'}
          </Badge>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-100">
            {isMissingPaymobConfig ? 'Paymob checkout is not configured yet' : 'Secure payment preview'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {isMissingPaymobConfig
              ? 'Add the required Paymob server credentials before trying to charge this receipt. This page is only a safe preview and does not mark payment as paid.'
              : 'This preview does not complete payment by itself. Only the verified Paymob webhook can finalize the receipt.'}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Provider</p>
              <p className="mt-2 text-lg font-black text-slate-950 dark:text-slate-100">Paymob</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Status</p>
              <p className="mt-2 text-lg font-black text-slate-950 dark:text-slate-100">{previewStatus}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Amount</p>
              <p className="mt-2 text-lg font-black text-slate-950 dark:text-slate-100">{amountLabel}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Currency</p>
              <p className="mt-2 text-lg font-black text-slate-950 dark:text-slate-100">{attempt.currency}</p>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800">
            <div className="grid gap-px bg-slate-200 dark:bg-slate-800">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 bg-white px-4 py-3 dark:bg-slate-900">
                <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Receipt ID</span>
                <span className="font-mono text-sm font-black text-slate-950 dark:text-slate-100">{shortId(attempt.receiptId)}</span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 bg-white px-4 py-3 dark:bg-slate-900">
                <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Cart session ID</span>
                <span className="font-mono text-sm font-black text-slate-950 dark:text-slate-100">{shortId(attempt.sessionId)}</span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 bg-white px-4 py-3 dark:bg-slate-900">
                <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Attempt status</span>
                <span className="text-sm font-black text-slate-950 dark:text-slate-100">{attempt.status}</span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 bg-white px-4 py-3 dark:bg-slate-900">
                <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Receipt payment status</span>
                <span className="text-sm font-black text-slate-950 dark:text-slate-100">{attempt.receipt.paymentStatus}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
            Opening this preview does not mark the receipt as paid. Only the verified Paymob webhook should finalize payment.
          </div>

          <SecurePreviewActions returnHref={returnHref} sessionId={attempt.sessionId} />
        </section>
      </main>
    </PageContainer>
  );
}
