import { POST } from '@/app/api/analyze/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { analyzeLead } from '@/lib/gemini';

// Mock dependencies
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
    prisma: {
        user: { findUnique: jest.fn(), update: jest.fn() },
        workspace: { update: jest.fn() },
        leadAnalysis: { findFirst: jest.fn(), updateMany: jest.fn() },
        usageEvent: { create: jest.fn().mockResolvedValue({}) },
    },
}));
jest.mock('@/lib/ai', () => ({
    resolveAiForRole: jest.fn().mockResolvedValue({
        config: { provider: 'GEMINI', model: 'gemini-flash', apiKey: 'test-key' },
    }),
}));
jest.mock('@/lib/gemini');
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(() => Promise.resolve({ success: true })) }));

describe('POST /api/analyze API Cost Shield', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return cached analysis and NOT call Gemini or charge credits if analysis exists in DB', async () => {
        // Mock session
        jest.mocked(auth).mockResolvedValue({ user: { id: 'test-user-id' } });

        // Mock user with onboarding done and workspace (required by route)
        prisma.user.findUnique.mockResolvedValue({
            id: 'test-user-id',
            onboardingCompletedAt: new Date(),
            workspaces: [{ workspace: { id: 'w1', leadsUsed: 5, leadsLimit: 100 } }]
        });

        // Mock existing analysis in DB
        const mockExistingAnalysis = {
            id: 'analysis-123',
            score: 9,
            scoreLabel: 'Quente',
            summary: 'Cached summary',
            strengths: ['S1'],
            weaknesses: ['W1'],
            painPoints: ['P1'],
            gaps: ['G1'],
            approach: 'A1',
            contactStrategy: 'C1',
            firstContactMessage: 'Hello cached',
            suggestedWhatsAppMessage: 'Zap cached',
            fullReport: 'Full report cached',
            socialInstagram: 'insta',
            socialFacebook: null,
            socialLinkedin: null,
            lead: {}
        };
        prisma.leadAnalysis.findFirst.mockResolvedValue(mockExistingAnalysis);

        const req = new NextRequest('http://localhost:3000/api/analyze', {
            method: 'POST',
            body: JSON.stringify({
                placeId: 'place-123',
                name: 'Test Business',
                locale: 'pt'
            })
        });

        const res = await POST(req);
        const data = await res.json();

        // Assertions
        expect(res.status).toBe(200);
        expect(data.summary).toBe('Cached summary');
        expect(data.gaps).toEqual(['G1']);

        // Verify Gemini API was NEVER called
        expect(analyzeLead).not.toHaveBeenCalled();

        // Credits are deducted on workspace, not user; ensure no unexpected updates
        expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should return 400 when placeId or name is missing', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' } });
        const req = new NextRequest('http://localhost/api/analyze', {
            method: 'POST',
            body: JSON.stringify({ placeId: 'p1' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toBeDefined();
    });

    it('should return 404 when user not found', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' } });
        prisma.user.findUnique.mockResolvedValue(null);
        const req = new NextRequest('http://localhost/api/analyze', {
            method: 'POST',
            body: JSON.stringify({ placeId: 'p1', name: 'Business' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(404);
        const json = await res.json();
        expect(json.error).toBe('Workspace not found');
    });

    it('should return 404 when user has no workspaces', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' } });
        prisma.user.findUnique.mockResolvedValue({
            id: 'u1',
            onboardingCompletedAt: new Date(),
            companyName: null,
            productService: null,
            targetAudience: null,
            mainBenefit: null,
            workspaces: [],
        });
        const req = new NextRequest('http://localhost/api/analyze', {
            method: 'POST',
            body: JSON.stringify({ placeId: 'p1', name: 'Business' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(404);
        const json = await res.json();
        expect(json.error).toBe('Workspace not found');
    });

    it('should return 403 REQUIRES_ONBOARDING when onboarding not completed', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' } });
        prisma.user.findUnique.mockResolvedValue({
            id: 'u1',
            onboardingCompletedAt: null,
            companyName: null,
            productService: null,
            targetAudience: null,
            mainBenefit: null,
            workspaces: [{ workspace: { id: 'w1', leadsUsed: 0, leadsLimit: 100 } }],
        });
        const req = new NextRequest('http://localhost/api/analyze', {
            method: 'POST',
            body: JSON.stringify({ placeId: 'p1', name: 'Business' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.code).toBe('REQUIRES_ONBOARDING');
    });

    it('should return 403 LIMIT_EXCEEDED when workspace leadsUsed >= leadsLimit', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' } });
        prisma.user.findUnique.mockResolvedValue({
            id: 'u1',
            onboardingCompletedAt: new Date(),
            companyName: null,
            productService: null,
            targetAudience: null,
            mainBenefit: null,
            workspaces: [
                { workspace: { id: 'w1', leadsUsed: 10, leadsLimit: 10, plan: 'FREE' } }
            ]
        });
        prisma.leadAnalysis.findFirst.mockResolvedValue(null);
        const req = new NextRequest('http://localhost/api/analyze', {
            method: 'POST',
            body: JSON.stringify({ placeId: 'p1', name: 'Business' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.code).toBe('LIMIT_EXCEEDED');
    });

    it('should return 200 and call Gemini when no cached analysis', async () => {
        jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' } });
        prisma.user.findUnique.mockResolvedValue({
            id: 'u1',
            onboardingCompletedAt: new Date(),
            companyName: 'Co',
            productService: null,
            targetAudience: null,
            mainBenefit: null,
            workspaces: [
                { workspace: { id: 'w1', leadsUsed: 0, leadsLimit: 100, plan: 'PRO' } }
            ]
        });
        prisma.leadAnalysis.findFirst.mockResolvedValue(null);
        prisma.workspace.update.mockResolvedValue({});
        prisma.leadAnalysis.updateMany.mockResolvedValue({ count: 0 });
        const mockAnalysis = { score: 8, summary: 'New', gaps: [], firstContactMessage: '', suggestedWhatsAppMessage: '' };
        jest.mocked(analyzeLead).mockResolvedValue({ analysis: mockAnalysis } as never);
        const req = new NextRequest('http://localhost/api/analyze', {
            method: 'POST',
            body: JSON.stringify({ placeId: 'p1', name: 'Business' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        expect(analyzeLead).toHaveBeenCalled();
        const data = await res.json();
        expect(data.summary).toBe('New');
    });
});
