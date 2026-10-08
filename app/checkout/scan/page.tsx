import { redirect } from 'next/navigation';
import { QrCode, ScanLine } from 'lucide-react';
import { StatusScreen } from '@/components/layout/StatusScreen';
import { ButtonLink } from '@/components/ui/Button';
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
    <StatusScreen
      icon={QrCode}
      tone="warning"
      title={title}
      description={description}
      actions={
        <ButtonLink href="/dashboard" size="lg">
          Back to home
        </ButtonLink>
      }
    />
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
      <StatusScreen
        icon={ScanLine}
        tone="brand"
        title="Open this QR from your Carto session"
        description="Sign in or continue as a guest on the same device that started this cart session, then scan the payment QR again."
        actions={
          <>
            <ButtonLink href="/auth/signin" size="lg">
              Sign in
            </ButtonLink>
            <ButtonLink href="/dashboard" size="lg" variant="outline">
              Back to home
            </ButtonLink>
          </>
        }
      />
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
