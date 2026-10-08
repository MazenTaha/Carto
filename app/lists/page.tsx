import { redirect } from 'next/navigation';
import { CreditCard, Plus, ShoppingCart } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { ListsOverview, type ListOverviewItem } from '@/components/lists/ListsOverview';
import { purgeExpiredShoppingLists } from '@/lib/list-retention';
import { ownerWhere, requireUserOrGuest } from '@/lib/guest-session';
import { getOwnedActiveCartSession } from '@/lib/active-cart-session';


function serializeList(list: any): ListOverviewItem {
  return {
    id: list.id,
    name: list.name,
    updatedAt: list.updatedAt ? new Date(list.updatedAt).toISOString() : null,
    deletedAt: list.deletedAt ? new Date(list.deletedAt).toISOString() : null,
    permanentDeleteAt: list.permanentDeleteAt ? new Date(list.permanentDeleteAt).toISOString() : null,
    _count: list._count,
  };
}

export default async function ListsPage({
  searchParams,
}: {
  searchParams?: { activate?: string };
}) {
  const owner = process.env.DATABASE_URL ? await requireUserOrGuest() : null;
  const isActivationFlow = searchParams?.activate === '1';

  if (!owner) {
    redirect('/auth/signin');
  }

  let lists: any[] = [];
  let deletedLists: any[] = [];
  let activeSession = null as Awaited<ReturnType<typeof getOwnedActiveCartSession>>;
  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import('@/lib/prisma');
      const ownerFilter = ownerWhere(owner);
      await purgeExpiredShoppingLists(prisma, ownerFilter);
      const [listsData, deletedListsData, activeSessionData] = await Promise.all([
        prisma.shoppingList.findMany({
          where: { ...ownerFilter, deletedAt: null, items: { some: {} } },
          include: { _count: { select: { items: true } } },
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.shoppingList.findMany({
          where: { ...ownerFilter, deletedAt: { not: null } },
          include: { _count: { select: { items: true } } },
          orderBy: { deletedAt: 'desc' },
        }),
        getOwnedActiveCartSession(owner),
      ]);
      lists = listsData;
      deletedLists = deletedListsData;
      activeSession = activeSessionData;
    } catch (error) {}
  }

  const activationDisabled = isActivationFlow && Boolean(activeSession);
  const activationDisabledMessage = 'Finish or disconnect the current cart session before starting another list.';
  const canCreateList = !activeSession;

  return (
    <AppShell>
      <PageHeader
        eyebrow={isActivationFlow ? <Badge tone="brand">Step 1 of 2 · Choose a list</Badge> : undefined}
        title={isActivationFlow ? 'Which list are you shopping with?' : 'My lists'}
        description={
          isActivationFlow
            ? 'Pick a list, then scan the QR code on your cart to send it to the cart display.'
            : 'Build reusable shopping lists, then activate one when you are at the store.'
        }
        actions={
          canCreateList && (
            <ButtonLink href="/lists/new" variant={isActivationFlow ? 'outline' : 'primary'}>
              <Plus aria-hidden="true" />
              New list
            </ButtonLink>
          )
        }
      />

      {activationDisabled && activeSession && (
        <Alert
          tone="success"
          title={`"${activeSession.shoppingList.name}" is already on ${activeSession.cartCode}`}
          className="mt-6"
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <ButtonLink href={`/session?sessionId=${encodeURIComponent(activeSession.sessionId)}`} size="sm">
                <ShoppingCart aria-hidden="true" />
                Continue session
              </ButtonLink>
              <ButtonLink
                href={`/session/ready?sessionId=${encodeURIComponent(activeSession.sessionId)}`}
                size="sm"
                variant="outline"
              >
                <CreditCard aria-hidden="true" />
                Continue to payment
              </ButtonLink>
            </div>
          }
        >
          {activationDisabledMessage}
        </Alert>
      )}

      <div className="mt-8">
        <ListsOverview
          lists={lists.map(serializeList)}
          deletedLists={deletedLists.map(serializeList)}
          isActivationFlow={isActivationFlow}
          activationDisabled={activationDisabled}
          activationDisabledMessage={activationDisabledMessage}
          canCreateList={canCreateList}
        />
      </div>
    </AppShell>
  );
}
