import { useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { useScrollToError } from '../hooks/useScrollToError';
import { parseApiError } from '../utils/parseApiError';
import type { ClientResponseDTO, DepotBottleDebtRequestDTO } from '../types';

interface Props {
  clients: ClientResponseDTO[];
  onClose: () => void;
  onSuccess: () => void;
}

export function NewBottleDebtModal({ clients, onClose, onSuccess }: Props) {
  const { http } = useAuth();
  const { notify } = useNotification();
  const [clientId, setClientId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [debtDate, setDebtDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const errorRef = useScrollToError<HTMLParagraphElement>(error);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!http || submitting.current) return;
    const count = Number(quantity);
    if (!clientId || !debtDate) { setError('Informe cliente e data.'); return; }
    if (!Number.isInteger(count) || count < 1 || count > 2147483647) {
      setError('Informe uma quantidade inteira entre 1 e 2147483647.');
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError('');
    try {
      const payload: DepotBottleDebtRequestDTO = { clientId, quantity: count, debtDate: `${debtDate}T00:00:00`, notes: notes.trim() || null };
      await http.post('/depot-bottle-debts', payload);
      notify('Pendência de garrafões registrada.', 'success');
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
    <Modal open title="Registrar garrafões devidos ao cliente" maxWidth="max-w-lg" onClose={() => { if (!submitting.current) onClose(); }}>
      <form onSubmit={submit} className="p-6 space-y-4 overflow-y-auto">
        {error && <p ref={errorRef} role="alert" className="text-sm text-error">{error}</p>}
        <fieldset disabled={saving} className="space-y-4">
          <label className="block text-sm text-on-surface-variant">Cliente *
            <select required value={clientId} onChange={e => setClientId(e.target.value)} className={inputClass}>
              <option value="">Selecione um cliente...</option>
              {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </label>
          <label className="block text-sm text-on-surface-variant">Quantidade *
            <input required type="number" min="1" max="2147483647" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} className={inputClass} />
          </label>
          <label className="block text-sm text-on-surface-variant">Data *
            <input required type="date" value={debtDate} onChange={e => setDebtDate(e.target.value)} className={inputClass} />
          </label>
          <label className="block text-sm text-on-surface-variant">Observação (opcional)
            <textarea maxLength={255} rows={3} value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} />
          </label>
        </fieldset>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" disabled={saving} onClick={onClose} className="px-4 py-2.5 border border-outline-variant rounded-lg text-on-surface-variant disabled:opacity-50">Cancelar</button>
          <button type="submit" disabled={saving || clients.length === 0} className="px-4 py-2.5 bg-primary text-on-primary rounded-lg font-bold disabled:opacity-50">{saving ? 'Registrando...' : 'Registrar pendência'}</button>
        </div>
      </form>
    </Modal>
  );
}
