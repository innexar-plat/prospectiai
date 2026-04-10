import React, { useCallback, useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    },
    [loading, onCancel],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    cancelRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
      onClick={() => !loading && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div
        className="rounded-xl border border-gray-200 bg-white w-full max-w-sm shadow-xl"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex-shrink-0 flex items-center justify-center rounded-full w-10 h-10 ${
                variant === 'danger' ? 'bg-red-100' : 'bg-violet-100'
              }`}
            >
              <AlertTriangle
                size={20}
                className={variant === 'danger' ? 'text-red-600' : 'text-violet-600'}
              />
            </div>
            <h3 id="confirm-title" className="text-base font-semibold text-gray-900">
              {title}
            </h3>
          </div>
          <p className="text-sm text-gray-600 ml-[52px]">{message}</p>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <Button
            ref={cancelRef}
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="sm"
            isLoading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
