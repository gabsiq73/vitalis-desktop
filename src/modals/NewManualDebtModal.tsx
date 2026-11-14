import { useEffect, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { useScrollToError } from '../hooks/useScrollToError';
import { parseApiError } from '../utils/parseApiError';
import type { ClientResponseDTO, ManualDebtRequestDTO, SpringPage } from '../types';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function NewManualDebtModal({ onClose, onSuccess }: Props) {
  const { http } = useAuth();
  const { notify } = useNotification();
  const [clients, setClients] = useState<ClientResponseDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadRevision, setLoadRevision] = useState(0);
  const [clientId, setClientId] = useState('');
  const [amount, setAmount] = useState('');
  const today = new Date().toLocaleDateString('en-CA');
  const [debtDate, setDebtDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const errorRef = useScrollToError<HTMLParagraphElement>(error || loadError);

  useEffect(() => {
    if (!http) return;
    let active = true;
    setLoading(true);
    setLoadError('');
    async function load() {
      const all: ClientResponseDTO[] = [];
      let page = 0;
      let pages = 1;
      while (page < pages) {
        const response = await http!.get<SpringPage<ClientResponseDTO>>('/clients', { params: { page, size: 100, sort: 'name,asc' } });
        all.push(...response.data.content);
        pages = response.data.totalPages;
        page += 1;
      }
      if (active) setClients(all);
    }
    load().catch(err => { if (active) setLoadError(parseApiError(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [http, loadRevision]);

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
      await http.post('/orders/manual-debts', payload);
      notify('Fiado registrado.', 'success');
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
    <Modal open title="Registrar fiado antigo" maxWidth="max-w-lg" onClose={() => { if (!submitting.current) onClose(); }}>
      <form onSubmit={submit} className="p-6 space-y-4 overflow-y-auto">
        <p className="text-sm text-slate-500">Registre o valor que o cliente ainda deve no caderno. Não gera venda, entrega, baixa de estoque ou entrada no caixa. Receba depois pelo pagamento do cliente.</p>
        {(error || loadError) && <p ref={errorRef} role="alert" className="text-sm text-error">{error || loadError}</p>}
        {loadError && <button type="button" onClick={() => setLoadRevision(value => value + 1)} className="text-primary text-sm underline">Tentar carregar clientes novamente</button>}
        <fieldset disabled={saving || loading || !!loadError} className="space-y-4">
          <label className="block text-sm text-on-surface-variant">Cliente *
            <select required value={clientId} onChange={e => setClientId(e.target.value)} className={inputClass}>
              <option value="">{loading ? 'Carregando clientes...' : 'Selecione um cliente...'}</option>
              {clients.map(client => <option key={client.id} value={client.id}>{client.name}{client.phone ? ` — ${client.phone}` : ''}</option>)}
            </select>
          </label>
          {!loading && !loadError && clients.length === 0 && <p className="text-sm text-slate-500">Cadastre o cliente na tela de Clientes antes de registrar o fiado.</p>}
          <label className="block text-sm text-on-surface-variant">Valor em aberto (R$) *
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
          <button type="submit" disabled={saving || loading || !!loadError || clients.length === 0} className="px-4 py-2.5 bg-primary text-on-primary rounded-lg font-bold disabled:opacity-50">{saving ? 'Registrando...' : 'Registrar fiado'}</button>
        </div>
      </form>
    </Modal>
  );
}
