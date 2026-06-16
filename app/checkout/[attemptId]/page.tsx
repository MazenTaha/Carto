import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { Badge } from '@/components/ui/Badge';
import { Logo } from '@/components/ui/Logo';
import { requireUserOrGuest } from '@/lib/guest-session';
import { DevicePaymentService } from '@/lib/services/device-payment.service';
import { PaymentService } from '@/lib/services/payment.service';
import { formatPaymentCurrency } from '@/lib/payment-money';

function isInternalUrl(url: string | null | undefined) {
  return Boolean(url && url.startsWith('/'));
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DeviceCheckoutPage({
  params,
  searchParams,
}: {
  params: { attemptId: string };
  searchParams?: { token?: string };
}) {
  const attemptId = params.attemptId?.trim();
  const token = searchParams?.token?.trim();

  if (!attemptId) {
    notFound();
  }

  let checkout: {
    id: string;
    sessionId: string;
    receiptId: string;
    amount: number;
    currency: string;
    status: string;
    paymentStatus: string;
    receiptStatus: string | null;
    checkoutUrl: string | null;
    cartCode: string | null;
    listName: string | null;
    paidAt: string | null;
  } | null = null;

  if (token) {
    const attempt = await DevicePaymentService.getPublicCheckoutAttempt(attemptId, token);
    if (!attempt) {
      notFound();
    }

    const view = DevicePaymentService.getPublicCheckoutView(attempt);
    checkout = {
      id: view.id,
      sessionId: view.sessionId,
      receiptId: view.receiptId,
      amount: view.amount,
      currency: view.currency,
      status: view.status,
      paymentStatus: view.paymentStatus,
      receiptStatus: view.receiptStatus,
      checkoutUrl: view.checkoutUrl,
      cartCode: view.cartCode,
      listName: view.listName,
      paidAt: view.paidAt,
    };
  } else {
    const owner = await requireUserOrGuest();
    if (!owner) {
      notFound();
    }

    const ownedAttempt = await PaymentService.getOwnedAttempt(owner, attemptId);
    if (!ownedAttempt || !ownedAttempt.receipt) {
      notFound();
    }

    checkout = {
      id: ownedAttempt.id,
      sessionId: ownedAttempt.sessionId,
      receiptId: ownedAttempt.receiptId,
      amount: ownedAttempt.receipt.total,
      currency: ownedAttempt.currency,
      status: ownedAttempt.status,
      paymentStatus: ownedAttempt.receipt.paymentStatus === 'COMPLETED' ? 'PAID' : ownedAttempt.receipt.paymentStatus,
      receiptStatus: ownedAttempt.receipt.status,
      checkoutUrl: ownedAttempt.checkoutUrl,
      cartCode: null,
      listName: null,
      paidAt: ownedAttempt.completedAt?.toISOString() ?? null,
    };
  }

  if (!checkout) {
    notFound();
  }

  const amountLabel = formatPaymentCurrency(checkout.amount, checkout.currency);
  const alreadyPaid = checkout.paymentStatus === 'PAID' || checkout.receiptStatus === 'PAID' || checkout.status === 'SUCCEEDED';
  const previewMode = isInternalUrl(checkout.checkoutUrl);
  const payHref = alreadyPaid
    ? `/payment/success?sessionId=${encodeURIComponent(checkout.sessionId)}&receiptId=${encodeURIComponent(checkout.receiptId)}&attemptId=${encodeURIComponent(checkout.id)}`
    : previewMode
    ? `/payment/pending?attemptId=${encodeURIComponent(checkout.id)}&sessionId=${encodeURIComponent(checkout.sessionId)}`
    : checkout.checkoutUrl || `/payment/pending?attemptId=${encodeURIComponent(checkout.id)}&sessionId=${encodeURIComponent(checkout.sessionId)}`;
  const sessionHref = `/session/ready?sessionId=${encodeURIComponent(checkout.sessionId)}`;

  return (
    <PageContainer maxWidth="md">
      <main className="flex min-h-screen items-center justify-center p-4">
        <section className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900 md:p-8">
          <div className="mb-8 flex justify-center">
            <Logo width={128} height={46} />
          </div>
          <Badge className="bg-primary/10 text-primary ring-primary/10">
            {alreadyPaid ? 'Payment confirmed' : previewMode ? 'Checkout preview' : 'Secure Checkout'}
          </Badge>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-100">
            {alreadyPaid ? 'Payment already confirmed' : 'Secure Checkout'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {alreadyPaid
              ? 'This receipt has already been paid and verified by the backend.'
              : previewMode
              ? 'Paymob credentials are not configured, so this secure preview page does not complete payment by itself.'
              : 'Carto validates this payment attempt first, then sends you to Paymob hosted checkout to pay securely in EGP.'}
          </p>

          {!alreadyPaid && (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
              <p className="font-black">Test mode payment</p>
              <p className="mt-2">Your cart session is still active while payment is pending. Only the verified Paymob webhook can mark the receipt as paid and complete checkout.</p>
            </div>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Amount</p>
              <p className="mt-2 text-lg font-black text-slate-950 dark:text-slate-100">{amountLabel}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Currency</p>
              <p className="mt-2 text-lg font-black text-slate-950 dark:text-slate-100">{checkout.currency}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Cart</p>
              <p className="mt-2 text-lg font-black text-slate-950 dark:text-slate-100">{checkout.cartCode || 'Carto device'}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">List</p>
              <p className="mt-2 text-lg font-black text-slate-950 dark:text-slate-100">{checkout.listName || 'Shopping session'}</p>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800">
            <div className="grid gap-px bg-slate-200 dark:bg-slate-800">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 bg-white px-4 py-3 dark:bg-slate-900">
                <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Receipt ID</span>
                <span className="font-mono text-sm font-black text-slate-950 dark:text-slate-100">{checkout.receiptId.slice(-6).toUpperCase()}</span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 bg-white px-4 py-3 dark:bg-slate-900">
                <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Cart session ID</span>
                <span className="font-mono text-sm font-black text-slate-950 dark:text-slate-100">{checkout.sessionId.slice(-6).toUpperCase()}</span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 bg-white px-4 py-3 dark:bg-slate-900">
                <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Payment status</span>
                <span className="text-sm font-black text-slate-950 dark:text-slate-100">{checkout.paymentStatus}</span>
              </div>
            </div>
          </div>

          {!alreadyPaid && (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              Opening this page or pressing continue does not mark the receipt as paid. Only the verified Paymob webhook can finalize payment.
            </div>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <a
              href={payHref}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-black text-white shadow-glow transition active:scale-[0.98]"
            >
              {alreadyPaid
                ? 'View payment result'
                : previewMode
                ? 'Preview mode only'
                : 'Continue to Paymob Checkout'}
            </a>
            <Link
              href={sessionHref}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:border-primary/30 hover:text-primary dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            >
              Back to my session
            </Link>
          </div>
        </section>
      </main>
    </PageContainer>
  );
}
