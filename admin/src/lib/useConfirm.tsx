import { useState, useCallback, useRef } from 'react';
import { ConfirmModal, type ConfirmModalProps } from '@/components/ui/ConfirmModal';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: ConfirmModalProps['variant'];
}

/** Drop-in replacement for window.confirm() that renders a styled modal. */
export function useConfirm() {
  const [state, setState] = useState<(ConfirmOptions & { open: boolean }) | null>(null);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({ ...opts, open: true });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setState(null);
  }, []);

  const handleCancel = useCallback(() => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setState(null);
  }, []);

  const ConfirmDialog = state?.open ? (
    <ConfirmModal
      open
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      variant={state.variant ?? 'danger'}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { confirm, ConfirmDialog };
}
