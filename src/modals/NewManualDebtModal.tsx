import { useRef, useState } from 'react';
import { ClientPicker } from '../components/ClientPicker';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { useScrollToError } from '../hooks/useScrollToError';
import { parseApiError } from '../utils/parseApiError';
import type { ClientResponseDTO, ManualDebtRequestDTO, OrderResponseDTO } from '../types';

interface Props {
  initial?: OrderResponseDTO;
  onClose: () => void;
  onSuccess: () => void;
}

export function NewManualDebtModal({ initial, onClose, onSuccess }: Props) {
  const { http } = useAuth();
  const { notify } = useNotification();
  const [client, setClient] = useState<Pick<ClientResponseDTO, 'id' | 'name'> | null>(null);
  const clientId = initial?.clientId ?? client?.id;
  const [amount, setAmount] = useState(initial?.totalValue.toString() ?? '');
  const today = new Date().toLocaleDateString('en-CA');
  const [debtDate, setDebtDate] = useState(initial?.deliveryDate?.slice(0, 10) ?? today);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const errorRef = useScrollToError<HTMLParagraphElement>(error);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!http || submitting.current) return;
    const value = Number(amount);
    if (!clientId || !debtDate || debtDate > today) {
      setError('Informe cliente e data do fiado, sem data futura.');
      return;
    }
    if (!Number.isFinite(value) || value < 0.01 || value > 99999999.99 || !/^\d+(\.\d{1,2})?$/.test(amount)) {
      setError('Informe um valor positivo com até duas casas decimais.');
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError('');
    try {
      const payload: ManualDebtRequestDTO = { clientId, amount: value, debtDate: `${debtDate}T00:00:00`, notes: notes.trim() || undefined };
      if (initial) await http.put(`/orders/manual-debts/${initial.id}`, payload);
      else await http.post('/orders/manual-debts', payload);
      notify(initial ? 'Fiado atualizado.' : 'Fiado registrado.', 'success');
      onSuccess();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  const inputClass = 'w-full mt-1 px-4 py-2.5 border border-outline-variant rounded-lg bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none';
  return (
    <Modal open title={initial ? 'Editar fiado antigo' : 'Registrar fiado antigo'} maxWidth="max-w-lg" onClose={() => { if (!submitting.current) onClose(); }}>
      <form onSubmit={submit} className="p-6 space-y-4 overflow-y-auto">
        <p className="text-sm text-slate-500">Registre o valor que o cliente ainda deve no caderno. Não gera venda, entrega, baixa de estoque ou entrada no caixa. Receba depois pelo pagamento do cliente.</p>
        {initial && <p className="text-sm text-slate-600">Corrija o valor total original do fiado. Pagamentos já registrados são preservados; se ultrapassarem o novo valor, a diferença vira crédito do cliente.</p>}
        {error && <p ref={errorRef} role="alert" className="text-sm text-error">{error}</p>}
        <fieldset disabled={saving} className="space-y-4">
          {initial ? (
            <label className="block text-sm text-on-surface-variant">Cliente *
              <input disabled value={initial.clientName} className={inputClass} />
            </label>
          ) : (
            <ClientPicker label="Cliente *" value={client} onChange={setClient} disabled={saving} />
          )}
          <label className="block text-sm text-on-surface-variant">{initial ? 'Valor total do fiado (R$) *' : 'Valor em aberto (R$) *'}
            <input required type="number" min="0.01" max="99999999.99" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={inputClass} />
          </label>
          <label className="block text-sm text-on-surface-variant">Data do fiado *
            <input required type="date" max={today} value={debtDate} onChange={e => setDebtDate(e.target.value)} className={inputClass} />
          </label>
          <label className="block text-sm text-on-surface-variant">Observação (opcional)
            <textarea maxLength={2000} rows={3} value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} />
          </label>
        </fieldset>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" disabled={saving} onClick={onClose} className="px-4 py-2.5 border border-outline-variant rounded-lg disabled:opacity-50">Cancelar</button>
          <button type="submit" disabled={saving || !clientId} className="px-4 py-2.5 bg-primary text-on-primary rounded-lg font-bold disabled:opacity-50">{saving ? 'Salvando...' : initial ? 'Salvar fiado' : 'Registrar fiado'}</button>
        </div>
      </form>
    </Modal>
  );
}
