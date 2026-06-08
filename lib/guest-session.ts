import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import type { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { GUEST_SESSION_COOKIE, GUEST_SESSION_MAX_AGE } from './guest-session.constants';

export type RequestOwner =
  | { type: 'user'; userId: string }
  | { type: 'guest'; guestSessionId: string };

export function getGuestSessionExpiresAt() {
  return new Date(Date.now() + GUEST_SESSION_MAX_AGE * 1000);
}

export function setGuestSessionCookie(response: NextResponse, guestSessionId: string) {
  response.cookies.set(GUEST_SESSION_COOKIE, guestSessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: GUEST_SESSION_MAX_AGE,
  });
}

export function clearGuestSessionCookie(response: NextResponse) {
  response.cookies.set(GUEST_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function clearLegacyGuestCookies(response: NextResponse) {
  for (const name of ['guest_mode', 'carto_guest_id', 'carto_guest_key']) {
    response.cookies.set(name, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }
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

export async function getGuestSession() {
  const guestSessionId = cookies().get(GUEST_SESSION_COOKIE)?.value;

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

export async function requireUserOrGuest(): Promise<RequestOwner | null> {
  const session = await getServerSession(authOptions);

  if (session?.user?.id) {
    return { type: 'user', userId: session.user.id };
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
