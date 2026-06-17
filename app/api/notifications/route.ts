// Notifications API route

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { withNoStoreHeaders } from '@/lib/http-cache';
import { prisma } from '@/lib/prisma';
import { markNotificationsReadSchema } from '@/lib/validations';

export const runtime = "nodejs";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/notifications - List user's notifications
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return withNoStoreHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
        }

        const { searchParams } = new URL(request.url);
        const unreadOnly = searchParams.get('unread') === 'true';
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

        const where: any = { userId: session.user.id };
        if (unreadOnly) {
            where.isRead = false;
        }

        const [notifications, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
            }),
            prisma.notification.count({
                where: { userId: session.user.id, isRead: false },
            }),
        ]);

        return withNoStoreHeaders(
            NextResponse.json({
                success: true,
                data: {
                    notifications,
                    unreadCount,
                },
            })
        );
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return withNoStoreHeaders(
            NextResponse.json(
                { error: 'Failed to fetch notifications' },
                { status: 500 }
            )
        );
    }
}

// PUT /api/notifications - Mark notifications as read
export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return withNoStoreHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
        }

        const body = await request.json();
        const { notificationIds } = markNotificationsReadSchema.parse(body);

        await prisma.notification.updateMany({
            where: {
                id: { in: notificationIds },
                userId: session.user.id,
            },
            data: { isRead: true },
        });

        return withNoStoreHeaders(NextResponse.json({ success: true }));
    } catch (error: any) {
        if (error.name === 'ZodError') {
            return withNoStoreHeaders(
                NextResponse.json(
                    { error: error.errors[0].message },
                    { status: 400 }
                )
            );
        }

        console.error('Error marking notifications read:', error);
        return withNoStoreHeaders(
            NextResponse.json(
                { error: 'Failed to update notifications' },
                { status: 500 }
            )
        );
    }
}
