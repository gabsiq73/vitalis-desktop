import { useEffect, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { parseApiError } from '../utils/parseApiError';
import type { BottleMode, GasPaymentMethod, OrderResponseDTO, ProductResponseDTO, SpringPage } from '../types';

export function EditCompletedOrderModal({ order, onClose, onSuccess }: { order: OrderResponseDTO; onClose: () => void; onSuccess: () => void }) {
  const { http } = useAuth();
  const [items, setItems] = useState(order.items.map(i => ({ ...i })));
  const [products, setProducts] = useState<ProductResponseDTO[]>([]);
  useEffect(() => {
    if (!http) return; let active = true;
    async function load() {
      const all: ProductResponseDTO[] = []; let page = 0; let pages = 1;
      while (page < pages) { const r = await http!.get<SpringPage<ProductResponseDTO>>('/products', { params: { page, size: 100 } }); all.push(...r.data.content); pages = r.data.totalPages; page++; }
      if (active) setProducts(all);
    }
    void load().catch(() => {}); return () => { active = false; };
  }, [http]);
  const [notes, setNotes] = useState(order.notes ?? '');
  const [date, setDate] = useState(order.deliveryDate?.slice(0, 16) ?? '');
  const [waterValue, setWaterValue] = useState(String(order.items.find(i => i.supplierId)?.promotionWaterValue ?? ''));
  const isPromotion = order.items.some(i => i.promotionWaterValue != null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const cls = 'w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm';
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!http || busy.current) return;
    busy.current = true; setSaving(true); setError('');
    try {
      const gas = items.find(i => i.supplierId); const water = items.find(i => !i.supplierId);
      await http.put(`/orders/${order.id}/correction`, { clientId: order.clientId, isDelivery: true, deliveryDate: date ? `${date}:00` : undefined, notes,
        items: items.map(i => ({ itemId: i.id, productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, bottleMode: i.bottleMode ?? 'REFILL', supplierId: i.supplierId, gasCostPrice: i.gasCostPrice, receivedByUs: i.receivedByUs, gasPaymentMethod: i.gasPaymentMethod })),
        ...(waterValue && gas && water ? { promotion: { waterProductId: water.productId, waterUnitValue: Number(waterValue), bundleUnitPrice: gas.unitPrice } } : {}),
      });
      onSuccess();
    } catch (err) { setError(parseApiError(err)); } finally { busy.current = false; setSaving(false); }
  }
  function change(index: number, values: Partial<typeof items[number]>) { setItems(old => old.map((i, n) => n === index ? { ...i, ...values } : i)); }
  return <Modal open title={order.status === 'DELIVERED' ? 'Editar pedido concluído' : 'Editar promoção'} maxWidth="max-w-2xl" onClose={() => { if (!busy.current) onClose(); }}>
    <form onSubmit={submit} className="p-6 space-y-4 overflow-y-auto">
      <p className="text-sm text-slate-600">A correção mantém o pedido e seus registros. Estoque, acertos e dívida serão atualizados. Valores pagos a mais viram crédito do cliente.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <fieldset disabled={saving} className="space-y-4">
        <label className="block text-sm">Data da entrega<input required type="datetime-local" value={date} onChange={e => setDate(e.target.value)} className={cls} /></label>
        {items.map((item, index) => <div key={item.id} className="p-3 border border-slate-200 rounded-lg space-y-2">
          <p className="font-semibold text-sm">{item.productName}</p>
          <label className="block text-sm">Produto<select aria-label={`Produto do item ${index + 1}`} value={item.productId} onChange={e => {
            const selected = products.find(p => p.id === e.target.value);
            if (selected) change(index, { productId: selected.id, productName: selected.name, ...(selected.type === 'GAS' ? { supplierId: selected.defaultSupplierId ?? item.supplierId, gasCostPrice: selected.lastCostPrice ?? item.gasCostPrice } : {}) });
          }} className={cls}>
            {!products.some(p => p.id === item.productId) && <option value={item.productId}>{item.productName}</option>}
            {products.filter(p => p.type === (item.supplierId ? 'GAS' : 'WATER')).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
          <div className="grid grid-cols-2 gap-3"><label className="text-sm">Quantidade<input aria-label={`Quantidade de ${item.productName}`} required type="number" min="1" step="1" value={item.quantity} onChange={e => change(index, { quantity: Number(e.target.value) })} className={cls} /></label>
            <label className="text-sm">Preço unitário<input aria-label={`Preço de ${item.productName}`} required type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => change(index, { unitPrice: Number(e.target.value) })} className={cls} /></label></div>
          {item.supplierId ? <><label className="block text-sm">Custo do gás<input required type="number" min="0" step="0.01" value={item.gasCostPrice ?? ''} onChange={e => change(index, { gasCostPrice: Number(e.target.value) })} className={cls} /></label>
            <label className="flex gap-2 text-sm"><input type="checkbox" checked={item.receivedByUs ?? false} onChange={e => change(index, { receivedByUs: e.target.checked })} />Recebido pelo depósito</label>
            {item.receivedByUs && <label className="block text-sm">Meio do recebimento<select required value={item.gasPaymentMethod ?? ''} onChange={e => change(index, { gasPaymentMethod: e.target.value as GasPaymentMethod })} className={cls}><option value="">Selecione...</option><option value="PIX">PIX</option><option value="DINHEIRO">Dinheiro</option></select></label>}
          </> : <label className="block text-sm">Tipo da venda<select value={item.bottleMode ?? 'REFILL'} onChange={e => change(index, { bottleMode: e.target.value as BottleMode })} className={cls}><option value="REFILL">Troca de água</option><option value="FULL">Garrafão completo</option><option value="EXPIRED">Vencido sem água</option></select></label>}
        </div>)}
        {isPromotion && <label className="block text-sm">Valor de referência da água na promoção<input required type="number" min="0.01" step="0.01" value={waterValue} onChange={e => setWaterValue(e.target.value)} className={cls} /></label>}
        <label className="block text-sm">Observação<textarea maxLength={2000} rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={cls} /></label>
      </fieldset>
      <div className="flex justify-end gap-3"><button type="button" disabled={saving} onClick={onClose} className="px-4 py-2 border rounded-lg">Cancelar</button><button disabled={saving} className="px-4 py-2 bg-primary text-white rounded-lg">{saving ? 'Salvando...' : 'Salvar correção'}</button></div>
    </form>
  </Modal>;
}
