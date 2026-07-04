import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function keydownOnDocument(key: string, mods: Partial<KeyboardEventInit> = {}) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...mods }));
}

function keydownOnElement(el: HTMLElement, key: string, mods: Partial<KeyboardEventInit> = {}) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...mods }));
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigates to /dashboard on N key', () => {
    renderHook(() => useKeyboardShortcuts());
    keydownOnDocument('n');
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('navigates to /dashboard/historico on H key', () => {
    renderHook(() => useKeyboardShortcuts());
    keydownOnDocument('h');
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/historico');
  });

  it('navigates to /dashboard/leads on L key', () => {
    renderHook(() => useKeyboardShortcuts());
    keydownOnDocument('l');
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/leads');
  });

  it('ignores keydown when modifier keys are pressed', () => {
    renderHook(() => useKeyboardShortcuts());
    keydownOnDocument('n', { ctrlKey: true });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('ignores keydown when meta key is pressed', () => {
    renderHook(() => useKeyboardShortcuts());
    keydownOnDocument('n', { metaKey: true });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('ignores keydown when alt key is pressed', () => {
    renderHook(() => useKeyboardShortcuts());
    keydownOnDocument('n', { altKey: true });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('ignores keydown when target is input element', () => {
    renderHook(() => useKeyboardShortcuts());
    const input = document.createElement('input');
    document.body.appendChild(input);
    keydownOnElement(input, 'n');
    expect(mockNavigate).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('ignores keydown when target is textarea', () => {
    renderHook(() => useKeyboardShortcuts());
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    keydownOnElement(textarea, 'h');
    expect(mockNavigate).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  it('ignores keydown when target is select', () => {
    renderHook(() => useKeyboardShortcuts());
    const select = document.createElement('select');
    document.body.appendChild(select);
    keydownOnElement(select, 'l');
    expect(mockNavigate).not.toHaveBeenCalled();
    document.body.removeChild(select);
  });

  it('removes event listener on unmount', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts());
    unmount();
    keydownOnDocument('n');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('ignores unrecognized keys', () => {
    renderHook(() => useKeyboardShortcuts());
    keydownOnDocument('x');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
