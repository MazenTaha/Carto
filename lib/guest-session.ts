import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import type { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { GUEST_SESSION_COOKIE, GUEST_SESSION_MAX_AGE, LEGACY_GUEST_SESSION_COOKIES } from './guest-session.constants';

export type RequestOwner =
  | { type: 'user'; userId: string }
  | { type: 'guest'; guestSessionId: string };

export function getGuestSessionExpiresAt() {
  return new Date(Date.now() + GUEST_SESSION_MAX_AGE * 1000);
}

export function setGuestSessionCookie(response: NextResponse, guestSessionId: string) {
  const isSecure = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  response.cookies.set(GUEST_SESSION_COOKIE, guestSessionId, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: GUEST_SESSION_MAX_AGE,
  });
}

export function clearGuestSessionCookie(response: NextResponse) {
  const isSecure = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  response.cookies.set(GUEST_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function clearLegacyGuestCookies(response: NextResponse) {
  const isSecure = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  for (const name of LEGACY_GUEST_SESSION_COOKIES) {
    response.cookies.set(name, '', {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }
}

function readGuestSessionCookieValue() {
  const cookieStore = cookies();

  for (const name of [GUEST_SESSION_COOKIE, ...LEGACY_GUEST_SESSION_COOKIES]) {
    const value = cookieStore.get(name)?.value?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

export async function createGuestSession() {
  return prisma.guestSession.create({
    data: {
      expiresAt: getGuestSessionExpiresAt(),
    },
    select: {
      id: true,
      expiresAt: true,
    },
  });
}

export async function renewGuestSession(guestSessionId: string) {
  return prisma.guestSession.update({
    where: { id: guestSessionId },
    data: {
      expiresAt: getGuestSessionExpiresAt(),
    },
    select: {
      id: true,
      expiresAt: true,
    },
  });
}

export async function getGuestSession() {
  const guestSessionId = readGuestSessionCookieValue();

  if (!guestSessionId) {
    return null;
  }

  const guestSession = await prisma.guestSession.findUnique({
    where: { id: guestSessionId },
    select: { id: true, expiresAt: true },
  });

  if (!guestSession) {
    return null;
  }

  if (guestSession.expiresAt && guestSession.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return guestSession;
}

export async function getAuthenticatedUserId() {
  try {
    const session = await getServerSession(authOptions);
    return session?.user?.id ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const digest = typeof error === 'object' && error !== null && 'digest' in error
      ? String((error as { digest?: string }).digest ?? '')
      : '';
    const isDynamicServerUsage = digest === 'DYNAMIC_SERVER_USAGE' || message.includes('Dynamic server usage');

    if (!isDynamicServerUsage) {
      console.error('Failed to read authenticated session. Falling back to guest session lookup.', error);
    }

    return null;
  }
}

export async function requireUserOrGuest(): Promise<RequestOwner | null> {
  const userId = await getAuthenticatedUserId();

  if (userId) {
    return { type: 'user', userId };
  }

  const guestSession = await getGuestSession();

  if (guestSession) {
    return { type: 'guest', guestSessionId: guestSession.id };
  }

  return null;
}

export function ownerWhere(owner: RequestOwner): Record<'userId' | 'guestSessionId', string | null> {
  return owner.type === 'user'
    ? { userId: owner.userId, guestSessionId: null }
    : { userId: null, guestSessionId: owner.guestSessionId };
}

export function ownerCreateData(owner: RequestOwner) {
  return owner.type === 'user'
    ? { userId: owner.userId, guestSessionId: null }
    : { userId: null, guestSessionId: owner.guestSessionId };
}

export async function migrateGuestDataToUser(guestSessionId: string, userId: string) {
  await prisma.$transaction([
    prisma.shoppingList.updateMany({
      where: { guestSessionId },
      data: { userId, guestSessionId: null },
    }),
    prisma.cartSession.updateMany({
      where: { guestSessionId },
      data: { userId, guestSessionId: null },
    }),
    prisma.receipt.updateMany({
      where: { guestSessionId },
      data: { userId, guestSessionId: null },
    }),
  ]);
}
