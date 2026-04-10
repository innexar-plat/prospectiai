import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

describe('ConfirmModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ConfirmModal open={false} title="Test" message="msg" onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders title and message when open', () => {
    render(
      <ConfirmModal open title="Excluir item" message="Tem certeza?" onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText('Excluir item')).toBeInTheDocument();
    expect(screen.getByText('Tem certeza?')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmModal open title="T" message="M" confirmLabel="OK" onConfirm={onConfirm} onCancel={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /OK/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmModal open title="T" message="M" onConfirm={() => {}} onCancel={onCancel} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onCancel on Escape key', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmModal open title="T" message="M" onConfirm={() => {}} onCancel={onCancel} />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('uses danger variant styling by default', () => {
    render(
      <ConfirmModal open title="T" message="M" onConfirm={() => {}} onCancel={() => {}} />,
    );
    const icon = document.querySelector('.bg-red-100');
    expect(icon).toBeInTheDocument();
  });
});
