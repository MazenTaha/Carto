import { notFound } from 'next/navigation';
import { SecurePreviewActions } from '@/components/payment/SecurePreviewActions';
import { FlaskConical, Lock } from 'lucide-react';
import { StatusScreen } from '@/components/layout/StatusScreen';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { requireUserOrGuest } from '@/lib/guest-session';
import { centsToAmount, formatPaymentCurrency } from '@/lib/payment-money';
import { PaymentService } from '@/lib/services/payment.service';

function getAttemptMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  return metadata as Record<string, unknown>;
}

function getMissingEnvList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
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
      <StatusScreen
        icon={Lock}
        tone="neutral"
        title="Payment preview unavailable"
        description="This link is missing its payment attempt ID."
        actions={
          <ButtonLink href="/dashboard" size="lg">
            Back to home
          </ButtonLink>
        }
      />
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
  const previewMissing = getMissingEnvList(attemptMetadata.previewMissing);
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
    <StatusScreen
      icon={FlaskConical}
      tone="warning"
      size="lg"
      eyebrow={<Badge tone="warning">{isMissingPaymobConfig ? 'Local preview mode' : 'Secure payment preview'}</Badge>}
      title={isMissingPaymobConfig ? 'Paymob is not configured here' : 'Secure payment preview'}
      description={
        isMissingPaymobConfig
          ? 'This environment cannot open a real hosted checkout, so this preview stands in for it. Nothing is charged and the receipt stays unpaid.'
          : 'This preview does not complete payment by itself. Only the verified Paymob webhook can finalize the receipt.'
      }
    >
      <div className="space-y-4">
        {isMissingPaymobConfig && previewMissing.length > 0 && (
          <Alert tone="warning" title="Missing Paymob variables">
            <span className="break-words font-mono text-xs">{previewMissing.join(', ')}</span>
          </Alert>
        )}

        <DescriptionList
          layout="grid"
          items={[
            { label: 'Amount', value: amountLabel },
            { label: 'Status', value: previewStatus },
            { label: 'Provider', value: 'Paymob' },
          ]}
        />

        <DescriptionList
          className="rounded-xl border border-line px-4 py-3"
          items={[
            { label: 'Receipt', value: shortId(attempt.receiptId), mono: true },
            { label: 'Cart session', value: shortId(attempt.sessionId), mono: true },
            { label: 'Attempt status', value: attempt.status },
            { label: 'Receipt payment', value: attempt.receipt.paymentStatus },
          ]}
        />

        <SecurePreviewActions returnHref={returnHref} sessionId={attempt.sessionId} />
      </div>
    </StatusScreen>
  );
}
