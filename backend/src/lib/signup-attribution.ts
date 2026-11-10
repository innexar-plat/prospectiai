/**
 * Where a customer came from: first-touch data captured by the SPA on the first visit
 * (UTM, external referrer, landing page) plus the onboarding answer "Como conheceu?".
 */
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const text = (max: number) => z.string().trim().max(max).optional().nullable();

export const HEARD_FROM_OPTIONS = ['google', 'instagram', 'facebook', 'linkedin', 'youtube', 'email', 'indicacao', 'whatsapp', 'chatgpt', 'outro'] as const;

export const attributionSchema = z.object({
    firstTouch: z.object({
        source: text(100),
        medium: text(100),
        campaign: text(150),
        referrer: text(300),
        landing: text(300),
        at: text(40),
    }).optional().nullable(),
    heardFrom: z.enum(HEARD_FROM_OPTIONS).optional().nullable(),
    heardFromOther: text(120),
});

export type AttributionInput = z.infer<typeof attributionSchema>;

/** First touch is written once (never overwritten); the onboarding answer can be updated. */
export async function saveAttribution(userId: string, input: AttributionInput): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { signupSource: true } });
    if (!user) return;
    const heard = input.heardFrom === 'outro' && input.heardFromOther ? `outro: ${input.heardFromOther}` : input.heardFrom;
    const data: { signupSource?: object; heardFrom?: string } = {};
    if (!user.signupSource && input.firstTouch && Object.values(input.firstTouch).some(Boolean)) {
        data.signupSource = input.firstTouch;
    }
    if (heard) data.heardFrom = heard;
    if (Object.keys(data).length > 0) await prisma.user.update({ where: { id: userId }, data });
}

const HEARD_LABEL: Record<string, string> = {
    google: 'Google', instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', youtube: 'YouTube',
    email: 'E-mail', indicacao: 'Indicação', whatsapp: 'WhatsApp', chatgpt: 'ChatGPT/IA', outro: 'Outro',
};

/** Human summary for alerts/admin: "Google · utm coldmail/sample · /empresas/... · disse: Indicação". */
export function describeAttribution(signupSource: unknown, heardFrom: string | null): string | null {
    const s = (signupSource && typeof signupSource === 'object' ? signupSource : {}) as Record<string, string | null | undefined>;
    const parts: string[] = [];
    if (s.source) parts.push(`utm ${[s.source, s.medium, s.campaign].filter(Boolean).join('/')}`);
    if (s.referrer) {
        try { parts.push(`veio de ${new URL(s.referrer).hostname.replace(/^www\./, '')}`); } catch { parts.push(`veio de ${s.referrer}`); }
    } else if (!s.source && s.landing) {
        parts.push('acesso direto');
    }
    if (s.landing) parts.push(`entrou em ${s.landing}`);
    if (heardFrom) {
        const [key, ...rest] = heardFrom.split(': ');
        parts.push(`disse: ${HEARD_LABEL[key!] ?? key}${rest.length ? ` (${rest.join(': ')})` : ''}`);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
}

export async function signupOriginLabel(userId: string | null | undefined): Promise<string | null> {
    if (!userId) return null;
    try {
        const u = await prisma.user.findUnique({ where: { id: userId }, select: { signupSource: true, heardFrom: true } });
        return u ? describeAttribution(u.signupSource, u.heardFrom) ?? 'sem origem registrada' : null;
    } catch {
        return null;
    }
}
