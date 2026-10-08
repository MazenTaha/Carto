import { redirect } from 'next/navigation';
import { CreditCard, ShoppingCart } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { NewListNamePageClient } from '@/components/lists/NewListNamePageClient';
import { getOwnedActiveCartSession } from '@/lib/active-cart-session';
import { requireUserOrGuest } from '@/lib/guest-session';
import { ACTIVE_SESSION_CREATE_LIST_MESSAGE } from '@/lib/list-constants';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function NewListPage() {
  const owner = process.env.DATABASE_URL ? await requireUserOrGuest() : null;

  if (!owner) {
    redirect('/auth/signin');
  }

  const activeSession = process.env.DATABASE_URL
    ? await getOwnedActiveCartSession(owner)
    : null;

  return (
    <AppShell back="/lists" title="New list" maxWidth="sm">
      {activeSession ? (
        <EmptyState
          icon={ShoppingCart}
          title="Finish your current session first"
          description={
            <>
              {ACTIVE_SESSION_CREATE_LIST_MESSAGE} Your list &quot;{activeSession.shoppingList.name}&quot; is connected to{' '}
              {activeSession.cartCode}.
            </>
          }
          action={
            <>
              <ButtonLink href={`/session?sessionId=${encodeURIComponent(activeSession.sessionId)}`}>
                <ShoppingCart aria-hidden="true" />
                Continue session
              </ButtonLink>
              <ButtonLink href={`/session/ready?sessionId=${encodeURIComponent(activeSession.sessionId)}`} variant="outline">
                <CreditCard aria-hidden="true" />
                Continue to payment
              </ButtonLink>
            </>
          }
        />
      ) : (
        <NewListNamePageClient />
      )}
    </AppShell>
  );
}
