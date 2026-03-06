import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { NotificationsPage } from '@/pages/NotificationsPage';

const mockList = vi.fn();
const mockChannelsList = vi.fn();

vi.mock('@/lib/api', () => ({
  adminApi: {
    notifications: { list: (...args: unknown[]) => mockList(...args) },
    notificationChannels: { list: () => mockChannelsList() },
  },
}));

describe('NotificationsPage', () => {
  beforeEach(() => {
    mockList.mockResolvedValue({ items: [], unreadCount: 0, limit: 50, offset: 0 });
    mockChannelsList.mockResolvedValue({ channels: [] });
  });

  it('loads and shows notifications section', async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<NotificationsPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText('Notificações', {}, { timeout: 3000 });
    expect(mockList).toHaveBeenCalled();
  });
});
