import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/ratelimit';
import { profileSchema, formatZodError, type ProfileInput } from '@/lib/validations/schemas';

function buildProfileUpdate(data: ProfileInput): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (data.name !== undefined) out.name = data.name;
    if (data.phone !== undefined) out.phone = data.phone;
    if (data.address !== undefined) out.address = data.address;
    if (data.linkedInUrl !== undefined) out.linkedInUrl = data.linkedInUrl;
    if (data.instagramUrl !== undefined) out.instagramUrl = data.instagramUrl;
    if (data.facebookUrl !== undefined) out.facebookUrl = data.facebookUrl;
    if (data.websiteUrl !== undefined) out.websiteUrl = data.websiteUrl;
    if (data.image !== undefined) out.image = data.image;
    if (data.notifyByEmail !== undefined) out.notifyByEmail = data.notifyByEmail;
    if (data.notifyWeeklyReport !== undefined) out.notifyWeeklyReport = data.notifyWeeklyReport;
    if (data.notifyLeadAlerts !== undefined) out.notifyLeadAlerts = data.notifyLeadAlerts;
    return out;
}

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

        const user = await prisma.user.update({
            where: { id: session.user.id },
            data: buildProfileUpdate(parsed.data),
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
