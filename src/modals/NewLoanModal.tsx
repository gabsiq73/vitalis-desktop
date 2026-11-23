import { useState, useEffect } from 'react';
import { ClientPicker } from '../components/ClientPicker';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { useScrollToError } from '../hooks/useScrollToError';
import { parseApiError } from '../utils/parseApiError';
import type { ClientResponseDTO, LoanedBottleRequestDTO } from '../types';

interface NewLoanModalProps {
  loan?: import('../types').LoanedBottleResponseDTO;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function NewLoanModal({ open, onClose, onSuccess, loan }: NewLoanModalProps) {
  const { http } = useAuth();
  const [client, setClient] = useState<Pick<ClientResponseDTO, 'id' | 'name'> | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useScrollToError<HTMLParagraphElement>(error);
  useEffect(() => {
    if (open) { setClient(loan ? { id: loan.clientId, name: loan.clientName } : null); setQuantity(loan?.quantity ?? 1); setError(''); }
  }, [open, loan]);

  function handleClose() {
    setClient(null);
    setQuantity(1);
    setError('');
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!client) { setError('Selecione um cliente.'); return; }
    if (!Number.isInteger(quantity) || quantity < 1) { setError('Informe uma quantidade inteira maior que zero.'); return; }
    setLoading(true);
    setError('');
    try {
      const payload: LoanedBottleRequestDTO = {
        clientId: client.id,
        quantity,
        loanDate: loan?.loanDate ?? null,
      };
      if (loan) await http!.put(`/bottles/${loan.id}`, payload);
      else await http!.post('/bottles', payload);
      onSuccess();
      handleClose();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={() => { if (!loading) handleClose(); }} title={loan ? 'Editar empréstimo' : 'Registrar Novo Empréstimo'} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <ClientPicker label="Cliente *" value={client} onChange={setClient} disabled={loading} />

        <div>
            <label htmlFor="loan-quantity" className="block text-label-sm text-on-surface-variant uppercase mb-1.5">Quantidade *</label>
            <input
              id="loan-quantity"
              type="number"
              min={1}
              step={1}
              required
              className="w-full px-4 py-2.5 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
        </div>

        <div className="p-3 bg-surface-container rounded-lg border border-dashed border-outline text-[12px] text-on-surface-variant">
          O empréstimo registra o garrafão, independentemente da água. A data é registrada automaticamente.
        </div>

        {error && <p ref={errorRef} className="text-sm text-error">{error}</p>}

        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-6 py-2.5 border border-outline-variant rounded-lg font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || !client}
            className="px-6 py-2.5 bg-primary text-on-primary rounded-lg font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-70"
          >
            {loading ? 'Salvando...' : loan ? 'Salvar empréstimo' : 'Confirmar Empréstimo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
