/**
 * Support tickets: customers open and reply from /dashboard/suporte, the team answers from the
 * admin. Every customer message reaches the support inbox (e-mail) and Telegram; every team reply
 * reaches the customer by e-mail, in-app notification and push.
 */
import type { SupportTicketCategory, SupportTicketStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/email';
import { buildEmail } from '@/lib/email-templates';
import { getSiteUrlForMarket } from '@/lib/site-url';
import { alertInfo } from '@/lib/telegram-alert';
import { createNotification } from '@/lib/notification-service';

export const SUPPORT_INBOX = process.env.SUPPORT_EMAIL ?? 'suporte@precisionia.com.br';

const CATEGORY_LABEL: Record<SupportTicketCategory, string> = {
    QUESTION: 'Dúvida',
    PROBLEM: 'Problema',
    BILLING: 'Pagamento / plano',
    SUGGESTION: 'Sugestão',
};

export class SupportError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
    }
}

const TICKET_LIST_SELECT = {
    id: true, number: true, subject: true, category: true, status: true, lastMessageAt: true, createdAt: true, closedAt: true,
} as const;

function escape(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function quote(body: string): string {
    return `<div style="border-left:3px solid #c7d2fe;padding:8px 12px;color:#374151;white-space:pre-wrap;">${escape(body)}</div>`;
}

function siteFor(market: string | null | undefined): string {
    return getSiteUrlForMarket(market === 'US' ? 'US' : 'BR').replace(/\/$/, '');
}

/** Customer → team: e-mail to the support inbox (reply-to the customer) and a Telegram ping. */
async function notifyTeam(ticket: { id: string; number: number; subject: string; category: SupportTicketCategory }, user: { email: string | null; name: string | null }, body: string, isNew: boolean): Promise<void> {
    const adminUrl = `${siteFor('BR')}/admin/suporte/${ticket.id}`;
    const title = `${isNew ? 'Novo chamado' : 'Resposta do cliente'} #${ticket.number}: ${ticket.subject}`;
    const html = buildEmail({
        title,
        preheader: body.slice(0, 90),
        body: [
            `<strong>${escape(user.name ?? 'Cliente')}</strong> (${escape(user.email ?? 'sem e-mail')}) · ${CATEGORY_LABEL[ticket.category]}`,
            quote(body),
            'Responda pelo painel admin para o cliente receber a resposta no sistema.',
        ],
        ctaHref: adminUrl,
        ctaLabel: 'Responder no admin',
        siteUrl: siteFor('BR'),
    });
    await Promise.all([
        sendEmail(SUPPORT_INBOX, `[Suporte #${ticket.number}] ${ticket.subject}`, html, user.email ? { replyTo: user.email } : {})
            .catch((err) => logger.warn('Support inbox e-mail failed', { ticketId: ticket.id, error: err instanceof Error ? err.message : 'Unknown' })),
        alertInfo(title, body.slice(0, 300), { cliente: user.email ?? '-', link: adminUrl }).catch(() => false),
    ]);
}

/** Team → customer: e-mail + in-app notification + push. */
async function notifyCustomer(ticket: { id: string; number: number; subject: string; userId: string }, body: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: ticket.userId }, select: { email: true, name: true, market: true } });
    if (!user) return;
    const site = siteFor(user.market);
    const link = `/dashboard/suporte?chamado=${ticket.id}`;
    if (user.email) {
        const html = buildEmail({
            title: `Respondemos seu chamado #${ticket.number}`,
            preheader: body.slice(0, 90),
            userName: user.name ?? undefined,
            body: [`Sobre <strong>${escape(ticket.subject)}</strong>:`, quote(body), 'Se precisar de mais alguma coisa, responda pelo próprio chamado.'],
            ctaHref: `${site}${link}`,
            ctaLabel: 'Ver chamado',
            siteUrl: site,
        });
        await sendEmail(user.email, `Resposta ao seu chamado #${ticket.number}: ${ticket.subject}`, html, { replyTo: SUPPORT_INBOX })
            .catch((err) => logger.warn('Support reply e-mail failed', { ticketId: ticket.id, error: err instanceof Error ? err.message : 'Unknown' }));
    }
    await createNotification({
        userId: ticket.userId,
        title: `Resposta no chamado #${ticket.number}`,
        message: body.slice(0, 140),
        link,
        market: user.market === 'US' ? 'US' : 'BR',
        locale: user.market === 'US' ? 'en' : 'pt',
    }).catch(() => undefined);
}

// ── Customer side ───────────────────────────────────────────────────────────

export async function createTicket(userId: string, input: { subject: string; category: SupportTicketCategory; message: string; context?: Record<string, unknown> }) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true, workspaces: { take: 1, orderBy: { workspace: { createdAt: 'asc' } }, select: { workspaceId: true, workspace: { select: { plan: true } } } } },
    });
    if (!user) throw new SupportError('User not found', 404);
    const membership = user.workspaces[0];
    const ticket = await prisma.supportTicket.create({
        data: {
            userId,
            workspaceId: membership?.workspaceId ?? null,
            subject: input.subject,
            category: input.category,
            context: { ...(input.context ?? {}), plan: membership?.workspace.plan ?? null },
            messages: { create: { authorType: 'USER', authorId: userId, body: input.message } },
        },
        select: { ...TICKET_LIST_SELECT },
    });
    await notifyTeam(ticket, user, input.message, true);
    return ticket;
}

export function listUserTickets(userId: string) {
    return prisma.supportTicket.findMany({
        where: { userId },
        orderBy: { lastMessageAt: 'desc' },
        take: 50,
        select: TICKET_LIST_SELECT,
    });
}

export async function getUserTicket(userId: string, ticketId: string) {
    const ticket = await prisma.supportTicket.findFirst({
        where: { id: ticketId, userId },
        select: { ...TICKET_LIST_SELECT, messages: { orderBy: { createdAt: 'asc' }, select: { id: true, authorType: true, body: true, createdAt: true } } },
    });
    if (!ticket) throw new SupportError('Ticket not found', 404);
    return ticket;
}

export async function addUserMessage(userId: string, ticketId: string, body: string) {
    const ticket = await prisma.supportTicket.findFirst({
        where: { id: ticketId, userId },
        select: { id: true, number: true, subject: true, category: true, user: { select: { email: true, name: true } } },
    });
    if (!ticket) throw new SupportError('Ticket not found', 404);
    const now = new Date();
    await prisma.$transaction([
        prisma.supportMessage.create({ data: { ticketId, authorType: 'USER', authorId: userId, body } }),
        // A customer message always puts the ticket back in the team's queue (reopens closed ones).
        prisma.supportTicket.update({ where: { id: ticketId }, data: { status: 'OPEN', lastMessageAt: now, closedAt: null } }),
    ]);
    await notifyTeam(ticket, ticket.user, body, false);
    return getUserTicket(userId, ticketId);
}

export async function closeUserTicket(userId: string, ticketId: string) {
    const found = await prisma.supportTicket.findFirst({ where: { id: ticketId, userId }, select: { id: true } });
    if (!found) throw new SupportError('Ticket not found', 404);
    await prisma.supportTicket.update({ where: { id: ticketId }, data: { status: 'CLOSED', closedAt: new Date() } });
    return getUserTicket(userId, ticketId);
}

// ── Team side (admin) ───────────────────────────────────────────────────────

export async function listTicketsForAdmin(status?: SupportTicketStatus) {
    const [tickets, counts] = await Promise.all([
        prisma.supportTicket.findMany({
            where: status ? { status } : {},
            // Waiting on us first, then most recent activity.
            orderBy: [{ status: 'asc' }, { lastMessageAt: 'desc' }],
            take: 200,
            select: { ...TICKET_LIST_SELECT, user: { select: { id: true, name: true, email: true } }, _count: { select: { messages: true } } },
        }),
        prisma.supportTicket.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    return { tickets, counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<SupportTicketStatus, number>> };
}

export async function getTicketForAdmin(ticketId: string) {
    const ticket = await prisma.supportTicket.findUnique({
        where: { id: ticketId },
        select: {
            ...TICKET_LIST_SELECT, context: true, workspaceId: true,
            user: { select: { id: true, name: true, email: true, market: true } },
            messages: { orderBy: { createdAt: 'asc' }, select: { id: true, authorType: true, body: true, createdAt: true } },
        },
    });
    if (!ticket) throw new SupportError('Ticket not found', 404);
    return ticket;
}

export async function addAdminReply(adminId: string, ticketId: string, body: string, closeAfter = false) {
    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId }, select: { id: true, number: true, subject: true, userId: true } });
    if (!ticket) throw new SupportError('Ticket not found', 404);
    const now = new Date();
    await prisma.$transaction([
        prisma.supportMessage.create({ data: { ticketId, authorType: 'ADMIN', authorId: adminId, body } }),
        prisma.supportTicket.update({
            where: { id: ticketId },
            data: { status: closeAfter ? 'CLOSED' : 'ANSWERED', lastMessageAt: now, closedAt: closeAfter ? now : null },
        }),
    ]);
    await notifyCustomer(ticket, body);
    return getTicketForAdmin(ticketId);
}

export async function setTicketStatusForAdmin(ticketId: string, status: SupportTicketStatus) {
    const found = await prisma.supportTicket.findUnique({ where: { id: ticketId }, select: { id: true } });
    if (!found) throw new SupportError('Ticket not found', 404);
    await prisma.supportTicket.update({ where: { id: ticketId }, data: { status, closedAt: status === 'CLOSED' ? new Date() : null } });
    return getTicketForAdmin(ticketId);
}
