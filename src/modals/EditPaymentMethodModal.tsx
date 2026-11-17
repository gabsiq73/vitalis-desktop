import { useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { useScrollToError } from '../hooks/useScrollToError';
import { formatBRL, formatDateTime } from '../utils/format';
import { parseApiError } from '../utils/parseApiError';
import type { GasPaymentMethod, PaymentResponseDTO } from '../types';

interface Props {
  payment: Pick<PaymentResponseDTO, 'id' | 'amount' | 'paymentDate' | 'paymentMethod'>;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditPaymentMethodModal({ payment, onClose, onSuccess }: Props) {
  const { http } = useAuth();
  const { notify } = useNotification();
  const [method, setMethod] = useState<GasPaymentMethod>(payment.paymentMethod === 'DINHEIRO' ? 'DINHEIRO' : 'PIX');
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const errorRef = useScrollToError<HTMLParagraphElement>(error);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!http || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError('');
    try {
      await http.patch(`/payments/${payment.id}/payment-method`, { paymentMethod: method });
      notify('Forma de pagamento corrigida.', 'success');
      onSuccess();
    } catch (err) { setError(parseApiError(err)); }
    finally { submitting.current = false; setSaving(false); }
  }

  return <Modal open title="Alterar forma de pagamento" maxWidth="max-w-md" onClose={() => { if (!submitting.current) onClose(); }}>
    <form onSubmit={submit} className="p-6 space-y-4">
      <p className="text-sm text-slate-600">Recebimento de {formatBRL(payment.amount)} em {formatDateTime(payment.paymentDate)}.</p>
      <p className="text-sm text-slate-600">A correção atualiza os saldos de PIX e Dinheiro na data original do recebimento. O valor e a quitação do pedido são preservados.</p>
      <label className="block text-sm font-semibold text-slate-700">Forma de pagamento
        <select aria-label="Forma de pagamento" disabled={saving} value={method} onChange={e => setMethod(e.target.value as GasPaymentMethod)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 bg-white">
          <option value="PIX">PIX</option><option value="DINHEIRO">Dinheiro</option>
        </select>
      </label>
      {error && <p ref={errorRef} role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" disabled={saving} onClick={onClose} className="px-4 py-2.5 border border-slate-200 rounded-lg disabled:opacity-50">Cancelar</button>
        <button type="submit" disabled={saving || method === payment.paymentMethod} className="px-4 py-2.5 bg-primary text-white font-bold rounded-lg disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar correção'}</button>
      </div>
    </form>
  </Modal>;
}
