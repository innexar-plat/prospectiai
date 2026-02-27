import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/ratelimit';
import { profileSchema, formatZodError } from '@/lib/validations/schemas';

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { success } = await rateLimit(`profile:${session.user.id}`, 30, 60);
        if (!success) {
            return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
        }

        const body = await req.json();
        const parsed = profileSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
        }
        const {
            name,
            phone,
            address,
            linkedInUrl,
            instagramUrl,
            facebookUrl,
            websiteUrl,
            image,
            notifyByEmail,
            notifyWeeklyReport,
            notifyLeadAlerts,
        } = parsed.data;

        const userUpdate: {
            name?: string;
            phone?: string;
            address?: string;
            linkedInUrl?: string;
            instagramUrl?: string;
            facebookUrl?: string;
            websiteUrl?: string;
            image?: string;
            notifyByEmail?: boolean;
            notifyWeeklyReport?: boolean;
            notifyLeadAlerts?: boolean;
        } = {};
        if (name !== undefined) userUpdate.name = name;
        if (phone !== undefined) userUpdate.phone = phone;
        if (address !== undefined) userUpdate.address = address;
        if (linkedInUrl !== undefined) userUpdate.linkedInUrl = linkedInUrl;
        if (instagramUrl !== undefined) userUpdate.instagramUrl = instagramUrl;
        if (facebookUrl !== undefined) userUpdate.facebookUrl = facebookUrl;
        if (websiteUrl !== undefined) userUpdate.websiteUrl = websiteUrl;
        if (image !== undefined) userUpdate.image = image;
        if (notifyByEmail !== undefined) userUpdate.notifyByEmail = notifyByEmail;
        if (notifyWeeklyReport !== undefined) userUpdate.notifyWeeklyReport = notifyWeeklyReport;
        if (notifyLeadAlerts !== undefined) userUpdate.notifyLeadAlerts = notifyLeadAlerts;

        const user = await prisma.user.update({
            where: { id: session.user.id },
            data: userUpdate,
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                phone: true,
                address: true,
                linkedInUrl: true,
                instagramUrl: true,
                facebookUrl: true,
                websiteUrl: true,
                notifyByEmail: true,
                notifyWeeklyReport: true,
                notifyLeadAlerts: true,
            },
        });

        return NextResponse.json({
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            phone: user.phone,
            address: user.address,
            linkedInUrl: user.linkedInUrl,
            instagramUrl: user.instagramUrl,
            facebookUrl: user.facebookUrl,
            websiteUrl: user.websiteUrl,
            notifyByEmail: user.notifyByEmail,
            notifyWeeklyReport: user.notifyWeeklyReport,
            notifyLeadAlerts: user.notifyLeadAlerts,
        });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Error updating profile', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
