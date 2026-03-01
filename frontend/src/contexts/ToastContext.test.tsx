import { render, screen, act, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from './ToastContext';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock crypto.randomUUID
if (!global.crypto) {
    (global as any).crypto = {};
}
if (!global.crypto.randomUUID) {
    global.crypto.randomUUID = vi.fn().mockReturnValue('test-uuid');
}

const TestComponent = () => {
    const { addToast } = useToast();
    return (
        <button onClick={() => addToast('success', 'Test Message', 1000)}>
            Add Toast
        </button>
    );
};

describe('ToastContext', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it('should add and remove a toast', async () => {
        render(
            <ToastProvider>
                <TestComponent />
            </ToastProvider>
        );

        const button = screen.getByText('Add Toast');
        fireEvent.click(button);

        expect(screen.getByText('Test Message')).toBeInTheDocument();

        // Move time forward to trigger auto-remove
        act(() => {
            vi.advanceTimersByTime(1500);
        });

        expect(screen.queryByText('Test Message')).not.toBeInTheDocument();
    });

    it('should allow manual removal of a toast', async () => {
        render(
            <ToastProvider>
                <TestComponent />
            </ToastProvider>
        );

        fireEvent.click(screen.getByText('Add Toast'));
        expect(screen.getByText('Test Message')).toBeInTheDocument();

        const closeButton = screen.getByLabelText('Fechar notificação');
        fireEvent.click(closeButton);

        expect(screen.queryByText('Test Message')).not.toBeInTheDocument();
    });

    it('should handle different toast types', () => {
        const TypeTest = () => {
            const { addToast } = useToast();
            return (
                <>
                    <button onClick={() => addToast('error', 'Error Message')}>Error</button>
                    <button onClick={() => addToast('warning', 'Warning Message')}>Warning</button>
                    <button onClick={() => addToast('info', 'Info Message')}>Info</button>
                </>
            );
        };

        render(
            <ToastProvider>
                <TypeTest />
            </ToastProvider>
        );

        fireEvent.click(screen.getByText('Error'));
        fireEvent.click(screen.getByText('Warning'));
        fireEvent.click(screen.getByText('Info'));

        expect(screen.getByText('Error Message')).toBeInTheDocument();
        expect(screen.getByText('Warning Message')).toBeInTheDocument();
        expect(screen.getByText('Info Message')).toBeInTheDocument();
    });
});
