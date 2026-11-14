import { useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { parseApiError } from '../utils/parseApiError';
import type { GasSettlementResponseDTO } from '../types';

export function EditGasSettlementModal({ settlement, onClose, onSuccess }: { settlement: GasSettlementResponseDTO; onClose: () => void; onSuccess: () => void }) {
  const { http } = useAuth();
  const [amount, setAmount] = useState(String(settlement.amount)); const [settled, setSettled] = useState(settlement.settled);
  const [date, setDate] = useState(settlement.settledDate?.slice(0,16) ?? new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16));
  const [method, setMethod] = useState(settlement.paymentMethod ?? ''); const [error, setError] = useState(''); const [saving, setSaving] = useState(false); const busy = useRef(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!http || busy.current) return;
    busy.current = true; setSaving(true); setError('');
    try { await http.put(`/gas-settlements/${settlement.id}`, { amount: Number(amount), settled, settledDate: settled ? `${date}:00` : null, paymentMethod: settled ? method : null }); onSuccess(); }
    catch (err) { setError(parseApiError(err)); } finally { busy.current = false; setSaving(false); }
  }
  const cls = 'w-full mt-1 border border-slate-200 px-3 py-2 rounded-lg';
  return <Modal open title="Editar acerto de gás" onClose={() => { if (!busy.current) onClose(); }} maxWidth="max-w-lg"><form onSubmit={submit} className="p-6 space-y-4 overflow-y-auto">
    <p className="text-sm text-slate-600">{settlement.supplierName}. O registro será mantido. Alterar valor, meio ou data atualiza o caixa nas datas correspondentes.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <fieldset disabled={saving} className="space-y-3"><label className="block text-sm">Valor unitário do acerto (R$)<input required type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={cls} /></label>
      <p className="text-xs text-slate-500">Quantidade: {settlement.quantity ?? 1}. Total: R$ {(Number(amount) * (settlement.quantity ?? 1)).toFixed(2)}</p>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={settled} onChange={e => setSettled(e.target.checked)} />Acertado</label>
      {settled && <><label className="block text-sm">Data do acerto<input required type="datetime-local" value={date} onChange={e => setDate(e.target.value)} className={cls} /></label><label className="block text-sm">Meio do acerto<select required value={method} onChange={e => setMethod(e.target.value)} className={cls}><option value="">Selecione...</option><option value="PIX">PIX</option><option value="DINHEIRO">Dinheiro</option></select></label></>}
    </fieldset><div className="flex justify-end gap-3"><button type="button" disabled={saving} onClick={onClose} className="px-4 py-2 border rounded-lg">Cancelar</button><button disabled={saving} className="px-4 py-2 bg-primary text-white rounded-lg">{saving ? 'Salvando...' : 'Salvar acerto'}</button></div>
  </form></Modal>;
}
