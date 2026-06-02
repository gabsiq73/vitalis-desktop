import { useState } from 'react';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import type { PaymentRequestDTO, PaymentMethod } from '../types';

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'PIX', label: 'PIX' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'SALDO', label: 'Saldo em conta' },
];

interface AddPaymentModalProps {
  open: boolean;
  orderId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddPaymentModal({ open, orderId, onClose, onSuccess }: AddPaymentModalProps) {
  const { http } = useAuth();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('PIX');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleClose() {
    setAmount('');
    setMethod('PIX');
    setNotes('');
    setError('');
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) { setError('Valor deve ser maior que zero.'); return; }
    if (notes && notes.length < 5) { setError('Observação deve ter mínimo 5 caracteres.'); return; }
    setLoading(true);
    setError('');
    try {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const paymentDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const payload: PaymentRequestDTO = {
        orderId,
        amount: value,
        paymentMethod: method,
        paymentDate,
        notes: notes.trim() || undefined,
      };
      await http!.post('/payments', payload);
      onSuccess();
      handleClose();
    } catch {
      setError('Erro ao registrar pagamento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Registrar Pagamento" maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <div>
          <label className="block text-label-sm text-on-surface-variant uppercase mb-1.5">Valor (R$) *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            autoFocus
            className="w-full px-4 py-2.5 border border-outline-variant rounded-lg text-body-lg font-bold bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-label-sm text-on-surface-variant uppercase mb-1.5">Forma de Pagamento *</label>
          <div className="flex gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMethod(m.value)}
                className={`flex-1 py-2 rounded-lg border font-bold text-sm transition-all ${
                  method === m.value
                    ? 'bg-primary text-on-primary border-primary'
                    : 'border-outline-variant text-on-surface-variant hover:border-primary/40'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-label-sm text-on-surface-variant uppercase mb-1.5">
            Observações <span className="normal-case text-on-surface-variant/60">(mín. 5 chars se preenchido)</span>
          </label>
          <textarea
            className="w-full px-4 py-2.5 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
            placeholder="Ex: Pagamento referente à parcela 1/2"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-6 py-2.5 border border-outline-variant rounded-lg font-bold text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-primary text-on-primary rounded-lg font-bold hover:brightness-110 disabled:opacity-70 transition-all"
          >
            {loading ? 'Registrando...' : 'Confirmar Pagamento'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
