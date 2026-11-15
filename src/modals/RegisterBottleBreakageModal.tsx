import { useEffect, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { useRevealSection } from '../hooks/useRevealSection';
import { useScrollToError } from '../hooks/useScrollToError';
import { parseApiError } from '../utils/parseApiError';
import type { BottleBreakageRequestDTO, BottleInventoryResponseDTO, BottleValidity, SpringPage, StockResponseDTO } from '../types';

export function RegisterBottleBreakageModal({ inventory, onClose, onSuccess }: {
  inventory: BottleInventoryResponseDTO; onClose: () => void; onSuccess: () => void;
}) {
  const { http } = useAuth();
  const { notify } = useNotification();
  const revealSection = useRevealSection();
  const [validity, setValidity] = useState<BottleValidity>('VALID');
  const [quantity, setQuantity] = useState('1');
  const [filled, setFilled] = useState(false);
  const [waterId, setWaterId] = useState('');
  const [waters, setWaters] = useState<StockResponseDTO[]>([]);
  const [loadingWaters, setLoadingWaters] = useState(false);
  const [watersError, setWatersError] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useScrollToError<HTMLParagraphElement>(error);
  const busy = useRef(false);
  useEffect(() => {
    if (!http || !filled) return;
    let active = true;
    setLoadingWaters(true); setWatersError('');
    async function load() {
      const all: StockResponseDTO[] = []; let page = 0; let pages = 1;
      while (page < pages) {
        const r = await http!.get<SpringPage<StockResponseDTO>>('/stocks', { params: { page, size: 200 } });
        all.push(...r.data.content); pages = r.data.totalPages; page++;
      }
      if (active) setWaters(all);
    }
    void load().catch(err => { if (active) setWatersError(parseApiError(err)); })
      .finally(() => { if (active) setLoadingWaters(false); });
    return () => { active = false; };
  }, [http, filled]);
  const amount = Number(quantity);
  const total = validity === 'VALID' ? inventory.validQuantity : inventory.expiredQuantity;
  const selectedWater = waters.find(w => w.productId === waterId);
  const available = filled ? Math.min(total, selectedWater?.quantityInStock ?? total)
    : validity === 'VALID' ? inventory.emptyValidQuantity : total;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!http || busy.current) return;
    if (!Number.isInteger(amount) || amount < 1) { setError('Informe uma quantidade inteira positiva.'); return; }
    if (filled && (!waterId || loadingWaters || watersError)) { setError('Selecione a água dos garrafões cheios.'); return; }
    busy.current = true; setSaving(true); setError('');
    try {
      const payload: BottleBreakageRequestDTO = { validity, quantity: amount, notes: notes.trim(), ...(filled ? { waterProductId: waterId } : {}) };
      await http.post('/bottle-inventory/breakages', payload);
      notify('Quebra registrada. O estoque de garrafões foi atualizado.', 'success');
      onSuccess();
    } catch (err) { setError(parseApiError(err)); }
    finally { busy.current = false; setSaving(false); }
  }
  const cls = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30';
  return <Modal open title="Registrar quebra de garrafão" maxWidth="max-w-lg" onClose={() => { if (!busy.current) onClose(); }}>
    <form onSubmit={submit} className="overflow-y-auto p-6 space-y-4">
      {error && <p ref={errorRef} role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <fieldset data-reveal-section disabled={saving} className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">Tipo do garrafão<select aria-label="Tipo do garrafão" value={validity} onChange={e => setValidity(e.target.value as BottleValidity)} className={cls}><option value="VALID">Válido</option><option value="EXPIRED">Vencido</option></select></label>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={filled} onChange={e => { setFilled(e.target.checked); if (e.target.checked) revealSection(e.currentTarget); }} />Garrafão cheio (baixar também a água)</label>
        {filled && <div data-reveal-content className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
          <label className="block text-sm font-medium text-blue-900">Água dos garrafões quebrados<select aria-label="Água dos garrafões quebrados" required disabled={loadingWaters || !!watersError} value={waterId} onChange={e => setWaterId(e.target.value)} className={cls}><option value="">{loadingWaters ? 'Carregando águas...' : 'Selecione a água...'}</option>{waters.map(w => <option key={w.productId} value={w.productId} disabled={w.quantityInStock === 0}>{w.productName} · {w.quantityInStock} cheia(s)</option>)}</select></label>
          {watersError && <p role="alert" className="text-sm text-red-700">{watersError}</p>}
          <p className="text-xs text-blue-900">A mesma quantidade será retirada do estoque desta água e do total de garrafões selecionado.</p>
        </div>}
        <label className="block text-sm font-medium text-slate-700">Quantidade quebrada<input autoFocus required type="number" min="1" step="1" max={available} value={quantity} onChange={e => setQuantity(e.target.value)} className={cls} /></label>
        <p className="text-xs text-slate-600">Disponível para este lançamento: {available} garrafão(ões){!filled && validity === 'VALID' ? ' válido(s) vazio(s)' : ''}.</p>
        <label className="block text-sm font-medium text-slate-700">Observação (opcional)<textarea maxLength={255} value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={cls} /></label>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><p>{Number.isInteger(amount) && amount > 0 ? `Serão retirados ${amount} garrafão(ões) ${validity === 'VALID' ? 'válido(s)' : 'vencido(s)'} do estoque.` : 'Informe a quantidade que saiu do estoque.'}</p><p className="mt-1 text-xs">Este registro não gera venda nem movimentação financeira.</p></div>
      </fieldset>
      <div className="flex justify-end gap-3"><button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm">Cancelar</button><button disabled={saving || available < 1 || (filled && (loadingWaters || !!watersError))} className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Registrando...' : 'Registrar quebra'}</button></div>
    </form>
  </Modal>;
}
