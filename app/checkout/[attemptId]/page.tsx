import { notFound } from 'next/navigation';
import { CircleCheck, ShieldCheck } from 'lucide-react';
import { StatusScreen } from '@/components/layout/StatusScreen';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink, buttonVariants } from '@/components/ui/Button';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { requireUserOrGuest } from '@/lib/guest-session';
import { DevicePaymentService } from '@/lib/services/device-payment.service';
import { PaymentService } from '@/lib/services/payment.service';
import { centsToAmount, formatPaymentCurrency } from '@/lib/payment-money';

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
      amount: centsToAmount(ownedAttempt.amountCents),
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
    : checkout.checkoutUrl || `/checkout?sessionId=${encodeURIComponent(checkout.sessionId)}`;
  const sessionHref = `/session/ready?sessionId=${encodeURIComponent(checkout.sessionId)}`;

  return (
    <StatusScreen
      icon={alreadyPaid ? CircleCheck : ShieldCheck}
      tone={alreadyPaid ? 'success' : 'brand'}
      size="lg"
      eyebrow={
        <Badge tone={alreadyPaid ? 'success' : previewMode ? 'warning' : 'brand'}>
          {alreadyPaid ? 'Payment confirmed' : previewMode ? 'Checkout preview' : 'Secure checkout'}
        </Badge>
      }
      title={alreadyPaid ? 'This receipt is already paid' : `Pay ${amountLabel}`}
      description={
        alreadyPaid
          ? 'The payment for this receipt was verified by the backend. No further action is needed.'
          : previewMode
            ? 'Paymob credentials are not configured, so this preview cannot complete a payment by itself.'
            : 'Carto validated this payment request. Continue to Paymob to pay securely in EGP.'
      }
      actions={
        <>
          <a href={payHref} className={buttonVariants({ size: 'lg' })}>
            {alreadyPaid ? 'View payment result' : previewMode ? 'Open preview' : 'Continue to Paymob'}
          </a>
          <ButtonLink href={sessionHref} size="lg" variant="outline">
            Back to my session
          </ButtonLink>
        </>
      }
    >
      <div className="space-y-4">
        <DescriptionList
          layout="grid"
          items={[
            { label: 'Amount', value: amountLabel },
            { label: 'Cart', value: checkout.cartCode || 'Carto device', mono: Boolean(checkout.cartCode) },
            { label: 'List', value: checkout.listName || 'Shopping session' },
          ]}
        />
        <DescriptionList
          className="rounded-xl border border-line px-4 py-3"
          items={[
            { label: 'Receipt', value: checkout.receiptId.slice(-6).toUpperCase(), mono: true },
            { label: 'Cart session', value: checkout.sessionId.slice(-6).toUpperCase(), mono: true },
            { label: 'Payment status', value: checkout.paymentStatus },
          ]}
        />
        {!alreadyPaid && (
          <Alert tone="info" title="Test mode payment">
            Your cart session stays active while payment is pending. Opening this page does not mark the receipt as paid —
            only the verified Paymob webhook can.
          </Alert>
        )}
      </div>
    </StatusScreen>
  );
}
