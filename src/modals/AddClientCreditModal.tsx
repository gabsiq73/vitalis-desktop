import { useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { parseApiError } from '../utils/parseApiError';
import type { ClientCreditRequestDTO, GasPaymentMethod } from '../types';

export function AddClientCreditModal({ clientId, clientName, onClose, onSuccess }: {
  clientId: string; clientName: string; onClose: () => void; onSuccess: () => void;
}) {
  const { http } = useAuth();
  const { notify } = useNotification();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<GasPaymentMethod>('PIX');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!http || busy.current) return;
    busy.current = true; setSaving(true); setError('');
    try {
      const payload: ClientCreditRequestDTO = { amount: Number(amount), paymentMethod: method };
      await http.post('/payments/credits/' + clientId, payload);
      notify('Recebimento registrado e saldo atualizado.', 'success');
      onSuccess();
    } catch (err) { setError(parseApiError(err)); }
    finally { busy.current = false; setSaving(false); }
  }
  const cls = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30';
  return <Modal open title="Adicionar saldo" onClose={() => { if (!busy.current) onClose(); }} maxWidth="max-w-lg">
    <form onSubmit={submit} className="overflow-y-auto p-6 space-y-4">
      <p className="text-sm text-slate-600">{clientName}</p>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <fieldset disabled={saving} className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">Valor recebido (R$)<input autoFocus required type="number" min="0.01" max="99999999.99" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={cls} /></label>
        <label className="block text-sm font-medium text-slate-700">Forma de recebimento<select value={method} onChange={e => setMethod(e.target.value as GasPaymentMethod)} className={cls}><option value="PIX">PIX</option><option value="DINHEIRO">Dinheiro</option></select></label>
        <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">O valor entra no Caixa do Dia. Se houver fiados, quita primeiro os pedidos mais antigos. O restante fica como saldo para pagar os próximos pedidos usando Crédito (saldo).</p>
      </fieldset>
      <div className="flex justify-end gap-3"><button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm">Cancelar</button><button disabled={saving} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white">{saving ? 'Salvando...' : 'Adicionar saldo'}</button></div>
    </form>
  </Modal>;
}
