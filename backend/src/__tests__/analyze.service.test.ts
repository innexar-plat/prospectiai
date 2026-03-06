import { describe, it, expect, beforeEach } from '@jest/globals';
import { runAnalyze, AnalyzeHttpError } from '@/modules/analyze/application/analyze.service';
import { prisma } from '@/lib/prisma';
import { checkMemberLimits, MemberLimitExceededError } from '@/lib/team-credits';
import { analyzeLead } from '@/lib/gemini';

jest.mock('@/lib/prisma', () => ({
    prisma: {
        user: { findUnique: jest.fn() },
        leadAnalysis: { findFirst: jest.fn(), updateMany: jest.fn() },
        workspace: { update: jest.fn() },
        searchHistory: { count: jest.fn() },
    },
}));

jest.mock('@/lib/team-credits', () => ({
    checkMemberLimits: jest.fn(),
    MemberLimitExceededError: class MemberLimitExceededError extends Error {
        constructor(
            message: string,
            public code: string,
            public period: 'daily' | 'weekly' | 'monthly',
            public used: number,
            public limit: number
        ) {
            super(message);
            this.name = 'MemberLimitExceededError';
        }
    },
}));

jest.mock('@/lib/ai', () => ({
    resolveAiForRole: jest.fn().mockResolvedValue({
        config: { provider: 'GEMINI', model: 'gemini-flash', apiKey: 'key' },
    }),
}));

jest.mock('@/lib/gemini');
jest.mock('@/lib/usage', () => ({ recordUsageEvent: jest.fn() }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));

const userId = 'u1';
const workspaceId = 'w1';

function defaultUser(overrides: Record<string, unknown> = {}) {
    return {
        onboardingCompletedAt: new Date(),
        companyName: null as string | null,
        productService: null as string | null,
        targetAudience: null as string | null,
        mainBenefit: null as string | null,
        workspaces: [
            {
                workspace: {
                    id: workspaceId,
                    leadsUsed: 0,
                    leadsLimit: 100,
                    plan: 'PRO' as const,
                    companyName: null as string | null,
                    productService: null as string | null,
                    targetAudience: null as string | null,
                    mainBenefit: null as string | null,
                },
                dailyLeadsLimit: null as number | null,
                weeklyLeadsLimit: null as number | null,
                monthlyLeadsLimit: null as number | null,
            },
        ],
        ...overrides,
    };
}

function defaultInput(overrides: Record<string, unknown> = {}) {
    return { placeId: 'place-1', name: 'Business', ...overrides };
}

describe('AnalyzeHttpError', () => {
    it('sets name, status, body and message from body.error', () => {
        const err = new AnalyzeHttpError(403, { error: 'Limit reached', code: 'LIMIT' });
        expect(err.name).toBe('AnalyzeHttpError');
        expect(err.status).toBe(403);
        expect(err.body).toEqual({ error: 'Limit reached', code: 'LIMIT' });
        expect(err.message).toBe('Limit reached');
    });

    it('uses default message when body.error is not a string', () => {
        const err = new AnalyzeHttpError(404, { error: { detail: 'x' } });
        expect(err.message).toBe('Request failed');
    });
});

describe('runAnalyze', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(defaultUser());
        (checkMemberLimits as jest.Mock).mockResolvedValue(undefined);
        (prisma.leadAnalysis.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.workspace.update as jest.Mock).mockResolvedValue({});
        (prisma.leadAnalysis.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
        (analyzeLead as jest.Mock).mockResolvedValue({
            analysis: { score: 8, summary: 'New', gaps: [], firstContactMessage: '', suggestedWhatsAppMessage: '' },
            provider: 'GEMINI',
            usage: { inputTokens: 10, outputTokens: 20 },
        });
    });

    it('throws 404 when user is not found', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
        let err: AnalyzeHttpError | undefined;
        try {
            await runAnalyze(defaultInput(), userId);
        } catch (e) {
            err = e as AnalyzeHttpError;
        }
        expect(err).toBeInstanceOf(AnalyzeHttpError);
        expect(err!.status).toBe(404);
        expect(err!.body.error).toBe('Workspace not found');
    });

    it('throws 404 when user has no workspaces', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(defaultUser({ workspaces: [] }));
        let err: AnalyzeHttpError | undefined;
        try {
            await runAnalyze(defaultInput(), userId);
        } catch (e) {
            err = e as AnalyzeHttpError;
        }
        expect(err).toBeInstanceOf(AnalyzeHttpError);
        expect(err!.status).toBe(404);
        expect(err!.body.error).toBe('Workspace not found');
    });

    it('throws 403 REQUIRES_ONBOARDING when onboarding not completed', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(defaultUser({ onboardingCompletedAt: null }));
        let err: AnalyzeHttpError | undefined;
        try {
            await runAnalyze(defaultInput(), userId);
        } catch (e) {
            err = e as AnalyzeHttpError;
        }
        expect(err).toBeInstanceOf(AnalyzeHttpError);
        expect(err!.status).toBe(403);
        expect(err!.body.code).toBe('REQUIRES_ONBOARDING');
    });

    it('throws 403 with MEMBER_LIMIT_EXCEEDED when checkMemberLimits throws MemberLimitExceededError', async () => {
        (checkMemberLimits as jest.Mock).mockRejectedValue(
            new MemberLimitExceededError('Limite diário atingido', 'MEMBER_LIMIT_EXCEEDED', 'daily', 5, 5)
        );
        let err: AnalyzeHttpError | undefined;
        try {
            await runAnalyze(defaultInput(), userId);
        } catch (e) {
            err = e as AnalyzeHttpError;
        }
        expect(err).toBeInstanceOf(AnalyzeHttpError);
        expect(err!.status).toBe(403);
        expect(err!.body.code).toBe('MEMBER_LIMIT_EXCEEDED');
        expect(err!.body.period).toBe('daily');
        expect(analyzeLead).not.toHaveBeenCalled();
    });

    it('rethrows when checkMemberLimits throws non-MemberLimitExceededError', async () => {
        (checkMemberLimits as jest.Mock).mockRejectedValue(new Error('DB connection failed'));
        await expect(runAnalyze(defaultInput(), userId)).rejects.toThrow('DB connection failed');
        expect(analyzeLead).not.toHaveBeenCalled();
    });

    it('returns cached analysis without calling analyzeLead', async () => {
        const existing = {
            score: 9,
            scoreLabel: 'Quente',
            summary: 'Cached',
            strengths: ['S1'],
            weaknesses: ['W1'],
            painPoints: ['P1'],
            gaps: ['G1'],
            approach: 'A',
            contactStrategy: 'C',
            firstContactMessage: 'Hi',
            suggestedWhatsAppMessage: 'Zap',
            fullReport: null,
            socialInstagram: 'ig',
            socialFacebook: null,
            socialLinkedin: null,
        };
        (prisma.leadAnalysis.findFirst as jest.Mock).mockResolvedValue(existing);
        const result = await runAnalyze(defaultInput(), userId);
        expect(result.summary).toBe('Cached');
        expect(result.gaps).toEqual(['G1']);
        expect(result.socialMedia.instagram).toBe('ig');
        expect(result.aiProvider).toBeUndefined();
        expect(analyzeLead).not.toHaveBeenCalled();
    });

    it('maps cached analysis with nulls and non-array painPoints to safe defaults', async () => {
        (prisma.leadAnalysis.findFirst as jest.Mock).mockResolvedValue({
            score: null,
            scoreLabel: null,
            summary: null,
            strengths: null,
            weaknesses: null,
            painPoints: 'invalid',
            gaps: null,
            approach: null,
            contactStrategy: null,
            firstContactMessage: null,
            suggestedWhatsAppMessage: null,
            fullReport: null,
            socialInstagram: null,
            socialFacebook: null,
            socialLinkedin: null,
        });
        const result = await runAnalyze(defaultInput(), userId);
        expect(result.score).toBe(0);
        expect(result.summary).toBe('');
        expect(result.painPoints).toEqual([]);
        expect(analyzeLead).not.toHaveBeenCalled();
    });

    it('throws 403 LIMIT_EXCEEDED when workspace leadsUsed >= leadsLimit', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(
            defaultUser({
                workspaces: [
                    {
                        workspace: {
                            id: workspaceId,
                            leadsUsed: 10,
                            leadsLimit: 10,
                            plan: 'FREE',
                            companyName: null,
                            productService: null,
                            targetAudience: null,
                            mainBenefit: null,
                        },
                        dailyLeadsLimit: null,
                        weeklyLeadsLimit: null,
                        monthlyLeadsLimit: null,
                    },
                ],
            })
        );
        let err: AnalyzeHttpError | undefined;
        try {
            await runAnalyze(defaultInput(), userId);
        } catch (e) {
            err = e as AnalyzeHttpError;
        }
        expect(err).toBeInstanceOf(AnalyzeHttpError);
        expect(err!.status).toBe(403);
        expect(err!.body.code).toBe('LIMIT_EXCEEDED');
        expect(analyzeLead).not.toHaveBeenCalled();
    });

    it('calls analyzeLead, recordUsageEvent, workspace.update and returns result with aiProvider', async () => {
        const { recordUsageEvent } = require('@/lib/usage');
        const result = await runAnalyze(defaultInput(), userId);
        expect(result.summary).toBe('New');
        expect(result.aiProvider).toBe('GEMINI');
        expect(analyzeLead).toHaveBeenCalledWith(
            expect.objectContaining({ placeId: 'place-1', name: 'Business' }),
            expect.any(Object),
            'pt',
            userId,
            false,
            { workspaceId, userId }
        );
        expect(prisma.workspace.update).toHaveBeenCalledWith({
            where: { id: workspaceId },
            data: { leadsUsed: { increment: 1 } },
        });
        expect(prisma.leadAnalysis.updateMany).toHaveBeenCalledWith({
            where: { userId, workspaceId: null },
            data: { workspaceId },
        });
        expect(recordUsageEvent).toHaveBeenCalled();
    });

    it('passes userProfile to analyzeLead when provided', async () => {
        const input = defaultInput({
            userProfile: {
                companyName: 'MyCo',
                productService: 'Service',
                targetAudience: 'Audience',
                mainBenefit: 'Benefit',
            },
        });
        await runAnalyze(input, userId);
        expect(analyzeLead).toHaveBeenCalledWith(
            expect.any(Object),
            {
                companyName: 'MyCo',
                productService: 'Service',
                targetAudience: 'Audience',
                mainBenefit: 'Benefit',
            },
            'pt',
            userId,
            false,
            expect.any(Object)
        );
    });

    it('passes workspace/user fallback profile when userProfile is absent', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(
            defaultUser({
                companyName: 'UserCo',
                productService: 'UserSvc',
                targetAudience: null,
                mainBenefit: null,
                workspaces: [
                    {
                        workspace: {
                            id: workspaceId,
                            leadsUsed: 0,
                            leadsLimit: 100,
                            plan: 'PRO',
                            companyName: 'WsCo',
                            productService: 'WsSvc',
                            targetAudience: 'WsAud',
                            mainBenefit: 'WsBen',
                        },
                        dailyLeadsLimit: null,
                        weeklyLeadsLimit: null,
                        monthlyLeadsLimit: null,
                    },
                ],
            })
        );
        await runAnalyze(defaultInput(), userId);
        expect(analyzeLead).toHaveBeenCalledWith(
            expect.any(Object),
            {
                companyName: 'WsCo',
                productService: 'WsSvc',
                targetAudience: 'WsAud',
                mainBenefit: 'WsBen',
            },
            'pt',
            userId,
            false,
            expect.any(Object)
        );
    });
});
