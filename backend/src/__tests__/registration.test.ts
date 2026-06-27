import { buildRegistrationUserData, buildRegistrationWorkspaceData, defaultWorkspaceName } from '@/lib/registration';

describe('registration', () => {
    const originalMarket = process.env.MARKET;

    afterEach(() => {
        process.env.MARKET = originalMarket;
    });

    it('BR market creates inactive FREE user without auto-trial', () => {
        process.env.MARKET = 'BR';
        jest.resetModules();
        const { buildRegistrationUserData: buildUser, buildRegistrationWorkspaceData: buildWs } = require('@/lib/registration');
        expect(buildUser().plan).toBe('FREE');
        expect(buildUser().leadsLimit).toBe(0);
        const ws = buildWs('Test');
        expect(ws.plan).toBe('FREE');
        expect(ws.leadsLimit).toBe(0);
        expect(ws.subscriptionStatus).toBe('inactive');
    });

    it('US market creates inactive FREE user without trial', () => {
        process.env.MARKET = 'US';
        jest.resetModules();
        const { buildRegistrationUserData: buildUser, buildRegistrationWorkspaceData: buildWs } = require('@/lib/registration');
        expect(buildUser().plan).toBe('FREE');
        expect(buildUser().leadsLimit).toBe(0);
        const ws = buildWs('Test Workspace');
        expect(ws.plan).toBe('FREE');
        expect(ws.leadsLimit).toBe(0);
        expect(ws.subscriptionStatus).toBe('inactive');
    });

    it('defaultWorkspaceName is market-aware', () => {
        expect(defaultWorkspaceName('BR')).toBe('Meu Workspace');
        expect(defaultWorkspaceName('US')).toBe('My Workspace');
        expect(defaultWorkspaceName('US', 'Jane')).toBe('Jane - Workspace');
    });
});
