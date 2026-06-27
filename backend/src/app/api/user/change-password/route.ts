import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { rateLimit } from '@/lib/ratelimit';
import { z } from 'zod';

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
    newPassword: z.string().min(8, 'Nova senha deve ter no mínimo 8 caracteres').max(128),
});

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const { success } = await rateLimit(`change-password:${session.user.id}:${ip}`, 5, 3600);
    if (!success) {
        return NextResponse.json({ error: 'Muitas tentativas. Tente novamente mais tarde.' }, { status: 429 });
    }

    try {
        const body = await req.json();
        const parsed = changePasswordSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
                { status: 400 },
            );
        }

        const { currentPassword, newPassword } = parsed.data;

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { password: true },
        });

        if (!user?.password) {
            return NextResponse.json(
                { error: 'Sua conta usa login social (Google/GitHub). Não é possível alterar a senha por aqui.' },
                { status: 400 },
            );
        }

        const valid = await bcrypt.compare(currentPassword, user.password);
        if (!valid) {
            return NextResponse.json({ error: 'Senha atual incorreta.' }, { status: 400 });
        }

        if (currentPassword === newPassword) {
            return NextResponse.json({ error: 'A nova senha deve ser diferente da atual.' }, { status: 400 });
        }

        const hashed = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({
            where: { id: session.user.id },
            data: { password: hashed },
        });

        return NextResponse.json({ message: 'Senha alterada com sucesso.' });
    } catch (e) {
        const { logger } = await import('@/lib/logger');
        logger.error('Change password error', { error: e instanceof Error ? e.message : 'Unknown' });
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
