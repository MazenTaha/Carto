import { CircleCheck } from 'lucide-react';
import { StatusScreen } from '@/components/layout/StatusScreen';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';

export default function PaymentSuccessPage() {
  return (
    <StatusScreen
      icon={CircleCheck}
      tone="success"
      eyebrow={<Badge tone="success">Payment confirmed</Badge>}
      title="You're all set"
      description="Paymob confirmed your payment. Your receipt is marked as paid and the cart has been checked out. Thanks for shopping with Carto!"
      actions={
        <>
          <ButtonLink href="/history" size="lg">
            View receipts
          </ButtonLink>
          <ButtonLink href="/dashboard" size="lg" variant="outline">
            Back to home
          </ButtonLink>
        </>
      }
    />
  );
}
