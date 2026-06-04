import { useState } from 'react';
import { Modal } from './Modal';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  error?: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  danger = false,
  error,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="p-6">
        <p className="text-body-lg text-on-surface-variant mb-4">{message}</p>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
            {error}
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2.5 border border-outline-variant rounded-lg font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`px-6 py-2.5 rounded-lg font-bold transition-all disabled:opacity-70 ${
              danger
                ? 'bg-error text-on-error hover:brightness-110'
                : 'bg-primary text-on-primary hover:brightness-110'
            }`}
          >
            {loading ? 'Aguarde...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
