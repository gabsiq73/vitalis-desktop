import { useEffect, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { parseApiError } from '../utils/parseApiError';
import { formatBRL } from '../utils/format';
import type { ClientResponseDTO, GasPaymentMethod, ProductResponseDTO, SpringPage } from '../types';

export function NewGasWaterPromotionModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { http } = useAuth();
  const [clients, setClients] = useState<ClientResponseDTO[]>([]);
  const [products, setProducts] = useState<ProductResponseDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState(''); const [gasId, setGasId] = useState(''); const [waterId, setWaterId] = useState('');
  const [quantity, setQuantity] = useState('1'); const [price, setPrice] = useState('127'); const [cost, setCost] = useState(''); const [waterValue, setWaterValue] = useState('');
  const [received, setReceived] = useState(false); const [method, setMethod] = useState<GasPaymentMethod | ''>('');
  const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const busy = useRef(false);
  useEffect(() => {
    if (!http) return; let active = true;
    async function load<T>(route: string) {
      const all: T[] = []; let page = 0; let pages = 1;
      while (page < pages) { const r = await http!.get<SpringPage<T>>(route, { params: { page, size: 100 } }); all.push(...r.data.content); pages = r.data.totalPages; page++; }
      return all;
    }
    Promise.all([load<ClientResponseDTO>('/clients'), load<ProductResponseDTO>('/products')]).then(([c,p]) => { if (active) { setClients(c); setProducts(p.filter(x => x.isActive)); } })
      .catch(err => { if (active) setError(parseApiError(err)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [http]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!http || busy.current) return;
    busy.current = true; setSaving(true); setError('');
    try {
      await http.post('/orders', { clientId, isDelivery: true, items: [{ productId: gasId, quantity: Number(quantity), gasCostPrice: Number(cost), receivedByUs: received, ...(received ? { gasPaymentMethod: method } : {}) }],
        promotion: { waterProductId: waterId, bundleUnitPrice: Number(price), waterUnitValue: Number(waterValue) } });
      onSuccess();
    } catch (err) { setError(parseApiError(err)); } finally { busy.current = false; setSaving(false); }
  }
  const cls = 'w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm';
  return <Modal open title="Promoção Gás + água" onClose={() => { if (!busy.current) onClose(); }} maxWidth="max-w-lg">
    <form onSubmit={submit} className="p-6 space-y-4 overflow-y-auto">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <fieldset disabled={loading || saving} className="space-y-3">
        <label className="block text-sm">Cliente<select required value={clientId} onChange={e => setClientId(e.target.value)} className={cls}><option value="">Selecione...</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="block text-sm">Gás<select required value={gasId} onChange={e => { setGasId(e.target.value); setCost(String(products.find(p => p.id === e.target.value)?.lastCostPrice ?? '')); }} className={cls}><option value="">Selecione...</option>{products.filter(p => p.type === 'GAS').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="block text-sm">Água inclusa<select required value={waterId} onChange={e => { setWaterId(e.target.value); setWaterValue(String(products.find(p => p.id === e.target.value)?.basePrice ?? '')); }} className={cls}><option value="">Selecione...</option>{products.filter(p => p.type === 'WATER').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-3">{[
          ['Preço do conjunto (R$)', price, setPrice], ['Custo do gás (R$)', cost, setCost], ['Valor da água (R$)', waterValue, setWaterValue], ['Quantidade de conjuntos', quantity, setQuantity],
        ].map(([label,value,setter], index) => <label key={String(label)} className="text-sm">{String(label)}<input required type="number" min={index === 3 ? '1' : index === 1 ? '0' : '0.01'} step={index === 3 ? '1' : '0.01'} value={String(value)} onChange={e => (setter as typeof setPrice)(e.target.value)} className={cls} /></label>)}</div>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={received} onChange={e => setReceived(e.target.checked)} />Recebido pelo depósito</label>
        {received && <label className="block text-sm">Meio do recebimento<select required value={method} onChange={e => setMethod(e.target.value as GasPaymentMethod)} className={cls}><option value="">Selecione...</option><option value="PIX">PIX</option><option value="DINHEIRO">Dinheiro</option></select></label>}
        <div className="p-3 bg-blue-50 rounded-lg text-sm"><p>Total: {formatBRL(Number(price) * Number(quantity))}</p><p>Margem do gás após a água: {formatBRL((Number(price) - Number(cost) - Number(waterValue)) * Number(quantity))}</p>{!received && <p>Repasse da distribuidora (água + margem): {formatBRL((Number(price) - Number(cost)) * Number(quantity))}</p>}<p className="mt-1 text-xs">Uma água por gás. A entrega baixa a água do estoque, sem cobrar a água duas vezes.</p></div>
      </fieldset>
      <div className="flex justify-end gap-3"><button type="button" disabled={saving} onClick={onClose} className="px-4 py-2 border rounded-lg">Cancelar</button><button disabled={saving || loading} className="px-4 py-2 rounded-lg bg-primary text-white">{saving ? 'Salvando...' : 'Criar promoção'}</button></div>
    </form>
  </Modal>;
}
