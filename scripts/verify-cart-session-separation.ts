import { prisma } from '../lib/prisma';

function normalizeCartCode(input: string) {
  return input.trim().toLowerCase();
}

async function main() {
  const cartCode = normalizeCartCode(process.argv[2] ?? '');

  if (!cartCode) {
    console.error('Usage: npx tsx scripts/verify-cart-session-separation.ts <cart-code>');
    process.exit(1);
  }

  const cart = await prisma.cart.findFirst({
    where: {
      cartCode: {
        equals: cartCode,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      cartCode: true,
    },
  });

  if (!cart) {
    console.log(JSON.stringify({
      cartCode,
      activeSessionFound: false,
      message: 'Cart not found.',
    }, null, 2));
    return;
  }

  const session = await prisma.cartSession.findFirst({
    where: {
      cartId: cart.id,
      endedAt: null,
      status: 'ACTIVE',
    },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      startedAt: true,
      shoppingList: {
        select: {
          id: true,
          name: true,
          items: {
            select: {
              id: true,
              name: true,
              quantity: true,
            },
            orderBy: { id: 'asc' },
          },
        },
      },
      receipt: {
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          subtotal: true,
          tax: true,
          total: true,
          items: {
            select: {
              id: true,
              name: true,
              quantity: true,
              price: true,
            },
            orderBy: { scannedAt: 'desc' },
          },
        },
      },
    },
  });

  if (!session) {
    console.log(JSON.stringify({
      cartCode,
      activeSessionFound: false,
      message: 'No active session found for this cart.',
    }, null, 2));
    return;
  }

  const plannedItems = session.shoppingList.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
  }));
  const receiptItems = session.receipt?.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    price: item.price,
  })) ?? [];
  const plannedSignature = new Set(plannedItems.map((item) => `${item.name.toLowerCase()}::${item.quantity}`));
  const mirroredReceiptItems = receiptItems.filter((item) =>
    plannedSignature.has(`${item.name.toLowerCase()}::${item.quantity}`)
  );

  console.log(JSON.stringify({
    cartCode,
    activeSessionFound: true,
    sessionId: session.id,
    startedAt: session.startedAt.toISOString(),
    shoppingList: {
      id: session.shoppingList.id,
      name: session.shoppingList.name,
      itemCount: plannedItems.length,
      items: plannedItems,
    },
    receipt: session.receipt
      ? {
          id: session.receipt.id,
          status: session.receipt.status,
          paymentStatus: session.receipt.paymentStatus,
          subtotal: session.receipt.subtotal,
          tax: session.receipt.tax,
          total: session.receipt.total,
          itemCount: receiptItems.length,
          items: receiptItems,
        }
      : null,
    checks: {
      plannedItemCount: plannedItems.length,
      receiptItemCount: receiptItems.length,
      receiptStartsEmpty: receiptItems.length === 0 && (session.receipt?.subtotal ?? 0) === 0 && (session.receipt?.tax ?? 0) === 0 && (session.receipt?.total ?? 0) === 0,
      mirroredReceiptItems,
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('Failed to verify cart session separation.');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
