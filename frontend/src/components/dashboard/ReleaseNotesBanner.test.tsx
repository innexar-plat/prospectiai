import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('@/lib/version', () => ({
  APP_VERSION: '2.1.0',
}));

import { ReleaseNotesBanner } from './ReleaseNotesBanner';

describe('ReleaseNotesBanner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders current release highlights once for unseen version', () => {
    render(<ReleaseNotesBanner />);

    expect(screen.getByText(/novidades da versao 2.1.0/i)).toBeInTheDocument();
    expect(screen.getByText(/mais contexto e precisão nas análises dos leads/i)).toBeInTheDocument();
    expect(screen.getByText(/melhorias contínuas de desempenho, estabilidade e segurança/i)).toBeInTheDocument();
  });

  it('dismisses and persists current version', () => {
    render(<ReleaseNotesBanner />);

    fireEvent.click(screen.getByRole('button', { name: /fechar novidades/i }));

    expect(localStorage.getItem('release-notes-banner-dismissed:2.1.0')).toBe('1');
    expect(screen.queryByText(/novidades da versao 2.1.0/i)).not.toBeInTheDocument();
  });

  it('does not render when current version was already dismissed', () => {
    localStorage.setItem('release-notes-banner-dismissed:2.1.0', '1');

    render(<ReleaseNotesBanner />);

    expect(screen.queryByText(/novidades da versao 2.1.0/i)).not.toBeInTheDocument();
  });
});