import { render, screen } from '@testing-library/react';
import { SidebarNav } from './SidebarNav';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

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

// Mock Logo component
vi.mock('@/components/brand/Logo', () => ({
    Logo: ({ iconSize }: { iconSize: number }) => (
        <div data-testid="logo" data-iconsize={iconSize}>Logo</div>
    ),
}));

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
        localStorage.clear();
    });

    it('renders correctly in expanded state', () => {
        render(
            <MemoryRouter>
                <SidebarNav user={mockUser as any} onLogout={vi.fn()} />
            </MemoryRouter>
        );

        expect(screen.getByTestId('logo')).toBeInTheDocument();
        expect(screen.getByTestId('logo')).toHaveAttribute('data-iconsize', '24');
        expect(screen.getByText('Nova Busca')).toBeInTheDocument();
    });

    it('renders correctly in narrow state', () => {
        localStorage.setItem('prospector_sidebar_collapsed', '1');
        render(
            <MemoryRouter>
                <SidebarNav user={mockUser as any} onLogout={vi.fn()} />
            </MemoryRouter>
        );

        expect(screen.getByTestId('logo')).toBeInTheDocument();
        expect(screen.getByTestId('logo')).toHaveAttribute('data-iconsize', '28');
    });

    it('shows user information in footer', () => {
        render(
            <MemoryRouter>
                <SidebarNav user={mockUser as any} onLogout={vi.fn()} />
            </MemoryRouter>
        );

        expect(screen.getByText(/Test User/i)).toBeInTheDocument();
    });
});
