import { render, screen } from '@testing-library/react';
import { SidebarNav } from './SidebarNav';
import { getLocaleStorageKey } from '@/lib/locale';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { SessionUser } from '@/lib/api';

// Mock Lucide
vi.mock('lucide-react', async () => {
    const actual = await vi.importActual('lucide-react');
    return {
        ...actual,
        LayoutDashboard: () => <div data-testid="icon-dashboard" />,
        Search: () => <div data-testid="icon-search" />,
        History: () => <div data-testid="icon-history" />,
        Settings: () => <div data-testid="icon-settings" />,
        Users: () => <div data-testid="icon-users" />,
        Building2: () => <div data-testid="icon-building" />,
        ShieldCheck: () => <div data-testid="icon-shield" />,
        MessageSquare: () => <div data-testid="icon-message" />,
        LogOut: () => <div data-testid="icon-logout" />,
        ChevronDown: () => <div data-testid="icon-chevron-down" />,
        Lock: () => <div data-testid="icon-lock" />,
        Sparkles: () => <div data-testid="icon-sparkles" />,
        Clock: () => <div data-testid="icon-clock" />,
        Target: () => <div data-testid="icon-target" />,
        Swords: () => <div data-testid="icon-swords" />,
        BarChart3: () => <div data-testid="icon-barchart" />,
        TrendingUp: () => <div data-testid="icon-trending" />,
        User: () => <div data-testid="icon-user" />,
        CreditCard: () => <div data-testid="icon-credit" />,
        HelpCircle: () => <div data-testid="icon-help" />,
        PanelLeftClose: () => <div data-testid="icon-panel-close" />,
        PanelLeft: () => <div data-testid="icon-panel-open" />,
    };
});

const mockUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    plan: 'FREE',
    leadsUsed: 10,
    leadsLimit: 100,
};

describe('SidebarNav', () => {
    beforeEach(() => {
        const locale = localStorage.getItem(getLocaleStorageKey());
        localStorage.clear();
        if (locale) localStorage.setItem(getLocaleStorageKey(), locale);
    });

    it('renders correctly in expanded state', () => {
        render(
            <MemoryRouter>
                <SidebarNav user={mockUser as SessionUser} onLogout={vi.fn()} />
            </MemoryRouter>
        );

        expect(screen.getByRole('link', { name: /precision/i })).toBeInTheDocument();
        expect(screen.getByText('Nova Busca')).toBeInTheDocument();
    });

    it('renders correctly in narrow state', () => {
        localStorage.setItem('prospector_sidebar_collapsed', '1');
        render(
            <MemoryRouter>
                <SidebarNav user={mockUser as SessionUser} onLogout={vi.fn()} />
            </MemoryRouter>
        );

        expect(screen.getByRole('button', { name: /expandir menu/i })).toBeInTheDocument();
        expect(screen.queryByText('Nova Busca')).not.toBeInTheDocument();
    });

    it('shows user information in footer', () => {
        render(
            <MemoryRouter>
                <SidebarNav user={mockUser as SessionUser} onLogout={vi.fn()} />
            </MemoryRouter>
        );

        expect(screen.getByText('Test')).toBeInTheDocument();
        expect(screen.getByText('10/100')).toBeInTheDocument();
    });

    it('shows subscribe CTA instead of 0/0 credits on US FREE without plan', () => {
        vi.stubGlobal('location', { ...window.location, hostname: 'precisionai.innexar.app', protocol: 'https:' });
        localStorage.setItem(getLocaleStorageKey(), 'en');
        const usFreeUser = { ...mockUser, leadsUsed: 0, leadsLimit: 0 } as SessionUser;

        render(
            <MemoryRouter>
                <SidebarNav user={usFreeUser} onLogout={vi.fn()} />
            </MemoryRouter>
        );

        expect(screen.queryByText('0/0')).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: /subscribe — 50 credits\/mo/i })).toHaveAttribute('href', '/dashboard/planos');
    });
});
