import { useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { parseApiError } from '../utils/parseApiError';

export function RedeemWaterCreditModal({ orderId, productName, quantity, onClose, onSuccess }: {
  orderId: string; productName: string; quantity: number; onClose: () => void; onSuccess: () => void;
}) {
  const { http } = useAuth();
  const { notify } = useNotification();
  const [amount, setAmount] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!http || busy.current) return;
    busy.current = true; setSaving(true); setError('');
    try {
      await http.post('/orders/' + orderId + '/redeem-water', { quantity: Number(amount) });
      notify('Água entregue e crédito atualizado, sem nova cobrança.', 'success');
      onSuccess();
    } catch (err) { setError(parseApiError(err)); }
    finally { busy.current = false; setSaving(false); }
  }
  return <Modal open title="Resgatar água da promoção" onClose={() => { if (!busy.current) onClose(); }} maxWidth="max-w-lg">
    <form onSubmit={submit} className="overflow-y-auto p-6 space-y-4">
      <p className="text-sm text-slate-600">{productName} · {quantity} água(s) em crédito</p>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <label className="block text-sm font-medium text-slate-700">Quantidade a entregar<input autoFocus required disabled={saving} type="number" min="1" max={quantity} step="1" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30" /></label>
      <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Confirme somente quando a água for entregue. A quantidade será baixada do estoque e do crédito do cliente. Não haverá nova cobrança.</p>
      <div className="flex justify-end gap-3"><button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm">Cancelar</button><button disabled={saving} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white">{saving ? 'Registrando...' : 'Confirmar entrega da água'}</button></div>
    </form>
  </Modal>;
}
