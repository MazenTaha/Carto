import { SearchX } from 'lucide-react';
import { StatusScreen } from '@/components/layout/StatusScreen';
import { ButtonLink } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <StatusScreen
      icon={SearchX}
      tone="neutral"
      title="Page not found"
      description="The page you requested is unavailable or may have moved."
      actions={
        <>
          <ButtonLink href="/dashboard" size="lg">
            Go to home
          </ButtonLink>
          <ButtonLink href="/auth/signin" size="lg" variant="outline">
            Sign in
          </ButtonLink>
        </>
      }
    />
  );
}
