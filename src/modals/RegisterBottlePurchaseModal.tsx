import { useEffect, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { useScrollToError } from '../hooks/useScrollToError';
import { parseApiError } from '../utils/parseApiError';
import type { BottlePurchaseRequestDTO, ProductResponseDTO, SpringPage } from '../types';

export function RegisterBottlePurchaseModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { http } = useAuth();
  const { notify } = useNotification();
  const [quantity, setQuantity] = useState('1');
  const [filled, setFilled] = useState(false);
  const [waterId, setWaterId] = useState('');
  const [waters, setWaters] = useState<ProductResponseDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useScrollToError<HTMLParagraphElement>(error || loadError);
  const busy = useRef(false);
  useEffect(() => {
    if (!http || !filled) return;
    let active = true;
    setLoading(true); setLoadError('');
    async function load() {
      const all: ProductResponseDTO[] = []; let page = 0; let pages = 1;
      while (page < pages) {
        const response = await http!.get<SpringPage<ProductResponseDTO>>('/products', { params: { page, size: 100, sort: 'name,asc' } });
        all.push(...response.data.content); pages = response.data.totalPages; page++;
      }
      if (active) setWaters(all.filter(p => p.type === 'WATER' && p.isActive));
    }
    void load().catch(err => { if (active) setLoadError(parseApiError(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [http, filled, revision]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!http || busy.current) return;
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount < 1 || amount > 2147483647) { setError('Informe uma quantidade inteira positiva.'); return; }
    if (filled && (!waterId || loading || loadError)) { setError('Selecione a água dos garrafões cheios.'); return; }
    busy.current = true; setSaving(true); setError('');
    try {
      const payload: BottlePurchaseRequestDTO = { quantity: amount, notes: notes.trim(), ...(filled ? { waterProductId: waterId } : {}) };
      await http.post('/bottle-inventory/purchases', payload);
      notify('Compra registrada. Estoque de garrafões atualizado.', 'success'); onSuccess();
    } catch (err) { setError(parseApiError(err)); }
    finally { busy.current = false; setSaving(false); }
  }
  const cls = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30';
  return <Modal open title="Registrar compra de garrafões" maxWidth="max-w-lg" onClose={() => { if (!busy.current) onClose(); }}>
    <form onSubmit={submit} className="overflow-y-auto p-6 space-y-4">
      <p className="text-sm text-slate-600">A compra aumenta o total de garrafões válidos do depósito. Se estiverem cheios, aumenta também o estoque da água escolhida.</p>
      {(error || (filled && loadError)) && <p ref={errorRef} role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error || loadError}</p>}
      <fieldset disabled={saving} className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">Garrafões comprados<select aria-label="Garrafões comprados" value={filled ? 'FILLED' : 'EMPTY'} onChange={e => setFilled(e.target.value === 'FILLED')} className={cls}><option value="EMPTY">Vazios</option><option value="FILLED">Cheios</option></select></label>
        {filled && <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <label className="block text-sm font-medium text-blue-900">Água dos garrafões comprados<select aria-label="Água dos garrafões comprados" required disabled={loading || !!loadError} value={waterId} onChange={e => setWaterId(e.target.value)} className={cls}><option value="">{loading ? 'Carregando águas...' : 'Selecione a água...'}</option>{waters.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
          {loadError && <button type="button" onClick={() => setRevision(value => value + 1)} className="text-sm text-primary underline">Tentar carregar águas novamente</button>}
          {!loading && !loadError && !waters.length && <p className="text-sm text-slate-600">Cadastre uma água ativa em Produtos antes de registrar a compra de garrafões cheios.</p>}
        </div>}
        <label className="block text-sm font-medium text-slate-700">Quantidade comprada<input autoFocus required type="number" min="1" max="2147483647" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} className={cls} /></label>
        <label className="block text-sm font-medium text-slate-700">Observação (opcional)<textarea maxLength={255} rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={cls} /></label>
        <p className="text-xs text-slate-500">Este registro controla quantidades. Registre o pagamento separadamente no Caixa do Dia, se necessário.</p>
      </fieldset>
      <div className="flex justify-end gap-3"><button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm">Cancelar</button><button disabled={saving || (filled && (loading || !!loadError || !waterId))} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Registrando...' : 'Registrar compra'}</button></div>
    </form>
  </Modal>;
}
