import { CircleX } from 'lucide-react';
import { StatusScreen } from '@/components/layout/StatusScreen';
import { Alert } from '@/components/ui/Alert';
import { ButtonLink } from '@/components/ui/Button';

export default function PaymentFailurePage({
  searchParams,
}: {
  searchParams?: { sessionId?: string; attemptId?: string };
}) {
  const sessionHref = searchParams?.sessionId
    ? `/session/ready?sessionId=${encodeURIComponent(searchParams.sessionId)}`
    : '/dashboard';

  return (
    <StatusScreen
      icon={CircleX}
      tone="danger"
      title="Payment not completed"
      description="Paymob did not confirm this payment, so nothing was charged and your receipt is still unpaid. You can go back and try again."
      actions={
        <>
          <ButtonLink href={sessionHref} size="lg">
            Try again
          </ButtonLink>
          <ButtonLink href="/dashboard" size="lg" variant="outline">
            Back to home
          </ButtonLink>
        </>
      }
    >
      <Alert tone="info">Test mode: your cart session stays active until a verified payment completes checkout.</Alert>
    </StatusScreen>
  );
}
