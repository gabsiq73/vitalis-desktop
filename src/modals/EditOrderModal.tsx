import { useState, useEffect, type FormEvent } from 'react';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { parseApiError } from '../utils/parseApiError';
import type { GasPaymentMethod, OrderItemRequestBody, OrderResponseDTO, ProductResponseDTO, SpringPage } from '../types';
import { formatBRL } from '../utils/format';
import { useScrollToError } from '../hooks/useScrollToError';

interface EditOrderModalProps {
  open: boolean;
  order: OrderResponseDTO;
  onClose: () => void;
  onSuccess: () => void;
}

interface EditItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  productName: string;
  isBonus: boolean;
  supplierId: string;
  gasCostPrice: number | undefined;
  receivedByUs: boolean | null | undefined;
  gasPaymentMethod: GasPaymentMethod | null;
  gasFinancialChanged: boolean;
}

const gasMethods: { value: GasPaymentMethod; label: string; icon: string }[] = [
  { value: 'PIX', label: 'PIX', icon: 'qr_code_2' },
  { value: 'DINHEIRO', label: 'Dinheiro', icon: 'payments' },
];

function toEditItem(i: OrderResponseDTO['items'][number]): EditItem {
  return {
    productId: i.productId,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    productName: i.productName,
    isBonus: i.unitPrice === 0,
    supplierId: i.supplierId ?? '',
    gasCostPrice: i.gasCostPrice,
    receivedByUs: i.receivedByUs,
    gasPaymentMethod: i.gasPaymentMethod ?? null,
    gasFinancialChanged: false,
  };
}

function localDatetimeOf(isoStr?: string | null): string {
  if (!isoStr) {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
  const d = new Date(isoStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditOrderModal({ open, order, onClose, onSuccess }: EditOrderModalProps) {
  const { http } = useAuth();

  const isShipped = order.status === 'SHIPPED';
  const isItemsReadOnly = order.status === 'DELIVERED' || order.status === 'CANCELLED';

  const [deliveryDate, setDeliveryDate] = useState(localDatetimeOf(order.deliveryDate));
  const [isDelivery, setIsDelivery] = useState(order.isDelivery ?? true);
  const [notes, setNotes] = useState(order.notes ?? '');

  // Items state — only editable when PENDING
  const [items, setItems] = useState<EditItem[]>(order.items.map(toEditItem));
  const [products, setProducts] = useState<ProductResponseDTO[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useScrollToError<HTMLDivElement>(error);

  useEffect(() => {
    if (!open) return;
    setDeliveryDate(localDatetimeOf(order.deliveryDate));
    setIsDelivery(order.isDelivery ?? true);
    setNotes(order.notes ?? '');
    setItems(order.items.map(toEditItem));
    setError(null);
  }, [open, order]);

  useEffect(() => {
    if (!http || !open || isShipped) return;
    http.get<SpringPage<ProductResponseDTO>>('/products', { params: { size: 100 } })
      .then((r) => setProducts(r.data.content.filter((p) => p.isActive)))
      .catch(() => {});
  }, [http, open, isShipped]);

  function addItem() {
    setItems((prev) => [...prev, { productId: '', quantity: 1, unitPrice: 0, productName: '', isBonus: false, supplierId: '', gasCostPrice: undefined, receivedByUs: false, gasPaymentMethod: null, gasFinancialChanged: true }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem<K extends keyof EditItem>(idx: number, field: K, value: EditItem[K]) {
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      if (field === 'productId') {
        const p = products.find((p) => p.id === value);
        return { ...item, productId: String(value), productName: p?.name ?? '', unitPrice: p?.basePrice ?? 0, supplierId: '', gasCostPrice: undefined, receivedByUs: false, gasPaymentMethod: null, gasFinancialChanged: true };
      }
      return { ...item, [field]: value, ...((field === 'receivedByUs' || field === 'gasPaymentMethod') ? { gasFinancialChanged: true } : {}) };
    }));
  }

  const total = items.reduce((sum, i) => sum + (i.isBonus ? 0 : i.unitPrice * i.quantity), 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!http) return;

    const validItems = items.filter((i) => i.productId && i.quantity > 0);
    if (!isShipped && validItems.length === 0) {
      setError('O pedido precisa ter pelo menos um item.');
      return;
    }
    if (validItems.some((i) => i.receivedByUs === true && !i.gasPaymentMethod && i.gasFinancialChanged)) {
      setError('Selecione PIX ou Dinheiro para o gás recebido por nós.');
      return;
    }
    const selectedGasMethods = new Set(validItems.filter((i) => i.receivedByUs && i.gasPaymentMethod).map((i) => i.gasPaymentMethod));
    if (selectedGasMethods.size > 1) {
      setError('Use o mesmo método de pagamento para os itens de gás do pedido.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const body = {
        clientId: order.clientId,
        deliveryDate: deliveryDate ? `${deliveryDate}:00` : undefined,
        isDelivery,
        notes: notes.trim() || undefined,
        items: validItems.map((i): OrderItemRequestBody => ({
          productId: i.productId,
          quantity: i.quantity,
          ...(!isShipped && i.isBonus ? { unitPrice: 0 } : {}),
          ...(i.supplierId ? { supplierId: i.supplierId } : {}),
          ...(i.gasCostPrice != null ? { gasCostPrice: i.gasCostPrice } : {}),
          ...(i.receivedByUs != null ? { receivedByUs: i.receivedByUs } : {}),
          ...(i.receivedByUs && i.gasPaymentMethod ? { gasPaymentMethod: i.gasPaymentMethod } : {}),
        })),
      };

      await http.put(`/orders/${order.id}`, body);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(parseApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = 'w-full border border-slate-200 rounded-lg bg-white text-[13px] py-2 px-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';

  return (
    <Modal open={open} onClose={onClose} title="Editar Pedido" maxWidth="max-w-3xl">
      <form onSubmit={handleSubmit} className="flex flex-col max-h-[80vh]">
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {error && (
            <div ref={errorRef} className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
              <span className="text-[13px] font-medium">{error}</span>
            </div>
          )}

          {isShipped && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-700 rounded-lg border border-amber-200">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>info</span>
              <span className="text-[13px]">Pedido em trânsito — apenas a data de entrega e o método do gás recebido podem ser alterados.</span>
            </div>
          )}
          {isShipped && items.map((item, idx) => (item.supplierId || item.gasCostPrice != null || item.receivedByUs != null || item.gasPaymentMethod != null) && (
            <div key={idx}>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Pagamento do gás recebido — {item.productName}
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-slate-600 mb-2">
                <input type="checkbox" checked={item.receivedByUs === true} disabled={isItemsReadOnly} onChange={(e) => updateItem(idx, 'receivedByUs', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer disabled:cursor-not-allowed" />
                Recebido por nós
              </label>
              {item.receivedByUs === true && <div className="flex gap-2">
                {gasMethods.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    disabled={isItemsReadOnly}
                    onClick={() => updateItem(idx, 'gasPaymentMethod', m.value)}
                    className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border text-[11px] font-bold transition-all ${
                      item.gasPaymentMethod === m.value
                        ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                        : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{m.icon}</span>
                    {m.label}
                  </button>
                ))}
              </div>}
            </div>
          ))}

          {/* Date + delivery type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Data de Entrega / Retirada
              </label>
              <input
                type="datetime-local"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Tipo de Pedido
              </label>
              <div className="flex gap-2">
                {[
                  { value: true,  label: 'Entrega',  icon: 'local_shipping' },
                  { value: false, label: 'Retirada', icon: 'shopping_bag' },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    disabled={isShipped}
                    onClick={() => setIsDelivery(opt.value)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-[13px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      isDelivery === opt.value
                        ? 'bg-primary text-white border-primary'
                        : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Observações <span className="normal-case text-slate-400 font-normal">(opcional, anotações internas)</span>
            </label>
            <textarea
              className={inputCls + ' resize-none'}
              placeholder="Ex: entregar no portão dos fundos"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Items (PENDING only) */}
          {!isShipped && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Itens do Pedido
                </label>
                <button
                  type="button"
                  disabled={isItemsReadOnly}
                  onClick={addItem}
                  className="flex items-center gap-1 text-primary font-semibold text-[13px] hover:underline"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add_circle</span>
                  Adicionar Item
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Produto</th>
                      <th className="px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-16 text-center">Qtd</th>
                      <th className="px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-24 text-right">Preço Unit.</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2">
                          <select
                            required
                            disabled={isItemsReadOnly}
                            value={item.productId}
                            onChange={(e) => updateItem(idx, 'productId', e.target.value)}
                            className="w-full border border-slate-200 rounded bg-white text-[13px] py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all text-slate-700"
                          >
                            <option value="">Selecionar produto...</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                          {(item.receivedByUs || products.find((p) => p.id === item.productId)?.type === 'GAS') && (
                            <div className="mt-2 space-y-2">
                              <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                                <input
                                  type="checkbox"
                                  checked={item.receivedByUs === true}
                                  disabled={isItemsReadOnly}
                                  onChange={(e) => updateItem(idx, 'receivedByUs', e.target.checked)}
                                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer"
                                />
                                Recebido por nós
                              </label>
                              {item.receivedByUs && (
                                <div className="flex gap-2">
                                  {gasMethods.map((m) => (
                                    <button
                                      key={m.value}
                                      type="button"
                                      disabled={isItemsReadOnly}
                                      onClick={() => updateItem(idx, 'gasPaymentMethod', m.value)}
                                      className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border text-[11px] font-bold transition-all ${
                                        item.gasPaymentMethod === m.value
                                          ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                                          : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300 hover:bg-slate-50'
                                      }`}
                                    >
                                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{m.icon}</span>
                                      {m.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            disabled={isItemsReadOnly}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            required
                            value={item.quantity === 0 ? '' : item.quantity}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, '');
                              updateItem(idx, 'quantity', digits === '' ? 0 : parseInt(digits, 10));
                            }}
                            onBlur={() => { if (!item.quantity) updateItem(idx, 'quantity', 1); }}
                            className="w-full border border-slate-200 rounded bg-white text-[13px] py-1.5 px-2 text-center focus:outline-none focus:ring-1 focus:ring-primary/20"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          {item.isBonus
                            ? <span className="text-[11px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">BÔNUS</span>
                            : <span className="text-[13px] font-semibold text-slate-700">{item.productId ? formatBRL(item.unitPrice * item.quantity) : '—'}</span>
                          }
                        </td>
                        <td className="px-2 py-2">
                          {items.length > 1 && (
                            <button
                              type="button"
                              disabled={isItemsReadOnly}
                              onClick={() => removeItem(idx)}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-200">
                      <td colSpan={2} className="px-3 py-2 text-[12px] font-semibold text-slate-500 uppercase tracking-wider">
                        Total estimado
                      </td>
                      <td className="px-3 py-2 text-right font-black text-[15px] text-primary">
                        {formatBRL(total)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 border border-slate-200 rounded-lg font-semibold text-[13px] text-slate-600 hover:bg-white transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-primary text-white rounded-lg font-bold text-[13px] hover:brightness-110 transition-all disabled:opacity-70 flex items-center gap-2 shadow-md shadow-primary/20"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span>
                Salvar Alterações
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
