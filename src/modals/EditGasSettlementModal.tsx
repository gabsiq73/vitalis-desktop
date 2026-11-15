import { useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { useRevealSection } from '../hooks/useRevealSection';
import { parseApiError } from '../utils/parseApiError';
import type { GasSettlementResponseDTO, GasSettlementUpdateDTO } from '../types';
import { formatBRL } from '../utils/format';

export function EditGasSettlementModal({ settlement, onClose, onSuccess }: { settlement: GasSettlementResponseDTO; onClose: () => void; onSuccess: () => void }) {
  const { http } = useAuth();
  const revealSection = useRevealSection();
  const [amount, setAmount] = useState(String(settlement.amount)); const [settled, setSettled] = useState(settlement.settled);
  const [salePrice, setSalePrice] = useState(String(settlement.salePrice ?? ''));
  const [costPrice, setCostPrice] = useState(String(settlement.costPrice ?? ''));
  const hasSale = !!settlement.orderItemId;
  const unitAmount = hasSale ? settlement.settlementType === 'YOU_OWE' ? Number(costPrice) : Number(salePrice) - Number(costPrice) : Number(amount);
  const [date, setDate] = useState(settlement.settledDate?.slice(0,16) ?? new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16));
  const [method, setMethod] = useState(settlement.paymentMethod ?? ''); const [error, setError] = useState(''); const [saving, setSaving] = useState(false); const busy = useRef(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!http || busy.current) return;
    busy.current = true; setSaving(true); setError('');
    try {
      const body: GasSettlementUpdateDTO = { amount: unitAmount, settled, settledDate: settled ? `${date}:00` : null, paymentMethod: settled ? method as 'PIX' | 'DINHEIRO' : null,
        ...(hasSale ? { salePrice: Number(salePrice), costPrice: Number(costPrice) } : {}) };
      await http.put(`/gas-settlements/${settlement.id}`, body); onSuccess();
    }
    catch (err) { setError(parseApiError(err)); } finally { busy.current = false; setSaving(false); }
  }
  const cls = 'w-full mt-1 border border-slate-200 px-3 py-2 rounded-lg';
  return <Modal open title="Editar acerto de gás" onClose={() => { if (!busy.current) onClose(); }} maxWidth="max-w-lg"><form onSubmit={submit} className="p-6 space-y-4 overflow-y-auto">
    <p className="text-sm text-slate-600">{settlement.supplierName}. O registro será mantido. Alterar valor, meio ou data atualiza o caixa nas datas correspondentes.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <fieldset data-reveal-section disabled={saving} className="space-y-3">
      {hasSale ? <>
        <label className="block text-sm">Preço de custo unitário (R$)<input required type="number" min="0" step="0.01" value={costPrice} onChange={e => setCostPrice(e.target.value)} className={cls} /></label>
        <label className="block text-sm">Preço de venda unitário (R$)<input required type="number" min="0" step="0.01" value={salePrice} onChange={e => setSalePrice(e.target.value)} className={cls} /></label>
        <p className="text-xs text-slate-500">A correção atualiza os preços no pedido e recalcula o acerto e os pagamentos. Na promoção, o preço de venda é o valor do conjunto.</p>
        <p className="text-sm text-slate-700">Valor unitário do acerto: {formatBRL(unitAmount)}</p>
      </> : <label className="block text-sm">Valor unitário do acerto (R$)<input required type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={cls} /></label>}
      <p className="text-xs text-slate-500">Quantidade: {settlement.quantity ?? 1}. Total: {formatBRL(unitAmount * (settlement.quantity ?? 1))}</p>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={settled} onChange={e => { setSettled(e.target.checked); if (e.target.checked) revealSection(e.currentTarget); }} />Acertado</label>
      {settled && <div data-reveal-content className="space-y-3"><label className="block text-sm">Data do acerto<input required type="datetime-local" value={date} onChange={e => setDate(e.target.value)} className={cls} /></label><label className="block text-sm">Meio do acerto<select required value={method} onChange={e => setMethod(e.target.value)} className={cls}><option value="">Selecione...</option><option value="PIX">PIX</option><option value="DINHEIRO">Dinheiro</option></select></label></div>}
    </fieldset><div className="flex justify-end gap-3"><button type="button" disabled={saving} onClick={onClose} className="px-4 py-2 border rounded-lg">Cancelar</button><button disabled={saving} className="px-4 py-2 bg-primary text-white rounded-lg">{saving ? 'Salvando...' : 'Salvar acerto'}</button></div>
  </form></Modal>;
}
