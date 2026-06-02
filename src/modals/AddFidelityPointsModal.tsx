import { useState, useEffect, type FormEvent } from 'react';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';

interface AddFidelityPointsModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clientId: string;
  clientName: string;
}

export function AddFidelityPointsModal({
  open,
  onClose,
  onSuccess,
  clientId,
  clientName,
}: AddFidelityPointsModalProps) {
  const { http, auth } = useAuth();
  const [points, setPoints] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPoints('');
      setPassword('');
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!http || !auth) return;

    const pts = parseInt(points, 10);
    if (!pts || pts <= 0) {
      setError('Informe uma quantidade válida de pontos.');
      return;
    }

    if (password !== auth.password) {
      setError('Senha incorreta. Verifique e tente novamente.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await http.patch(`/clients/${clientId}/add-fidelity-points`, null, { params: { points: pts } });
      onSuccess();
      onClose();
    } catch {
      setError('Erro ao adicionar pontos. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'w-full border border-outline-variant rounded-lg bg-surface-container-low text-body-md py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';
  const labelClass = 'block text-label-sm text-on-surface-variant mb-1';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adicionar Pontos de Fidelidade"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <div className="flex items-center gap-3 p-3 bg-surface-container rounded-xl">
          <span className="material-symbols-outlined text-tertiary" style={{ fontSize: '28px' }}>
            workspace_premium
          </span>
          <div>
            <p className="font-bold text-body-md text-on-surface">{clientName}</p>
            <p className="text-label-sm text-on-surface-variant">Adição manual de pontos de fidelidade</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-error-container text-on-error-container rounded-lg">
            <span className="material-symbols-outlined text-error" style={{ fontSize: '18px' }}>
              error
            </span>
            <span className="text-label-sm">{error}</span>
          </div>
        )}

        <div>
          <label className={labelClass}>Quantidade de Pontos *</label>
          <input
            type="number"
            min={1}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            placeholder="Ex: 100"
            className={inputClass}
            required
            autoFocus
          />
        </div>

        <div>
          <label className={labelClass}>Confirme sua senha *</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Digite sua senha"
            className={inputClass}
            required
          />
          <p className="text-label-sm text-on-surface-variant mt-1">
            Necessária para confirmar a operação.
          </p>
        </div>

        <div className="flex gap-3 justify-end pt-2 border-t border-outline-variant">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 border border-outline-variant rounded-lg font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 bg-tertiary text-on-tertiary rounded-lg font-bold hover:brightness-110 transition-all disabled:opacity-70 flex items-center gap-2"
          >
            {submitting ? (
              'Adicionando...'
            ) : (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  add_circle
                </span>
                Adicionar Pontos
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
