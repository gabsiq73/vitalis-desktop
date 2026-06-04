import { useState, useEffect, useRef, type FormEvent, useCallback } from 'react';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { AddFidelityPointsModal } from './AddFidelityPointsModal';
import type {
  ClientResponseDTO,
  ProductResponseDTO,
  GasSupplierResponseDTO,
  ClientPriceResponseDTO,
  SpringPage,
  OrderItemRequestBody,
  OrderRequestBody,
  PaymentMethod,
} from '../types';
import { formatBRL } from '../utils/format';

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'PIX',      label: 'PIX',      icon: 'qr_code_2' },
  { value: 'DINHEIRO', label: 'Dinheiro', icon: 'payments' },
  { value: 'SALDO',    label: 'Saldo',    icon: 'account_balance_wallet' },
];

interface ItemForm {
  productId: string;
  quantity: number;
  supplierId: string;
  gasCostPrice: string;
  receivedByUs: boolean;
  bottleExpiration: string;
}

interface NewOrderModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultClient?: ClientResponseDTO;
}

const emptyItem = (): ItemForm => ({
  productId: '',
  quantity: 1,
  supplierId: '',
  gasCostPrice: '',
  receivedByUs: false,
  bottleExpiration: '',
});

function nowDatetimeLocal() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function nowPaymentDate() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

export function NewOrderModal({ open, onClose, onSuccess, defaultClient }: NewOrderModalProps) {
  const { http } = useAuth();

  const [isAvulso, setIsAvulso] = useState(false);
  const [avulsoName, setAvulsoName] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientResponseDTO | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<ClientResponseDTO[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const [products, setProducts] = useState<ProductResponseDTO[]>([]);
  const [suppliers, setSuppliers] = useState<GasSupplierResponseDTO[]>([]);
  const [items, setItems] = useState<ItemForm[]>([emptyItem()]);

  const [isDelivery, setIsDelivery] = useState(true);
  const [deliveryDate, setDeliveryDate] = useState(nowDatetimeLocal);

  const [clientPrices, setClientPrices] = useState<ClientPriceResponseDTO[]>([]);

  const [registerPayment, setRegisterPayment] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const paymentAmountAutoSync = useRef(true);

  const [showAddPoints, setShowAddPoints] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setItems([emptyItem()]);
      setIsDelivery(true);
      setDeliveryDate(nowDatetimeLocal());
      setIsAvulso(false);
      setAvulsoName('');
      setClientPrices([]);
      setRegisterPayment(true);
      setPaymentAmount('');
      setPaymentMethod('PIX');
      paymentAmountAutoSync.current = true;
      if (defaultClient) {
        setSelectedClient(defaultClient);
        setClientSearch(defaultClient.name);
      } else {
        setSelectedClient(null);
        setClientSearch('');
      }
    }
  }, [open, defaultClient]);

  useEffect(() => {
    if (!http || !open) return;
    Promise.all([
      http.get<SpringPage<ProductResponseDTO>>('/products', { params: { size: 100 } }),
      http.get<SpringPage<GasSupplierResponseDTO>>('/suppliers', { params: { size: 100 } }),
    ])
      .then(([prodRes, suppRes]) => {
        setProducts(prodRes.data.content.filter((p) => p.isActive));
        setSuppliers(suppRes.data.content);
      })
      .catch(() => {});
  }, [http, open]);

  const searchClients = useCallback(
    async (query: string, showAll = false) => {
      if (!http) return;
      if (!showAll && query.length < 2) { setClientResults([]); return; }
      setSearchLoading(true);
      try {
        const params: Record<string, string | number> = { size: 50, sort: 'name,asc' };
        if (query.trim()) params.name = query.trim();
        const res = await http.get<SpringPage<ClientResponseDTO>>('/clients', { params });
        setClientResults(res.data.content);
      } catch {
        setClientResults([]);
      } finally {
        setSearchLoading(false);
      }
    },
    [http],
  );

  useEffect(() => {
    const t = setTimeout(() => searchClients(clientSearch), 350);
    return () => clearTimeout(t);
  }, [clientSearch, searchClients]);

  function selectClient(c: ClientResponseDTO) {
    setSelectedClient(c);
    setClientSearch(c.name);
    setShowDropdown(false);
    setClientResults([]);
    if (http) {
      http.get<ClientPriceResponseDTO[]>(`/clients/${c.id}/prices`)
        .then((r) => setClientPrices(r.data))
        .catch(() => setClientPrices([]));
    }
  }

  function addItem() { setItems((p) => [...p, emptyItem()]); }
  function removeItem(idx: number) { setItems((p) => p.filter((_, i) => i !== idx)); }
  function updateItem<K extends keyof ItemForm>(idx: number, key: K, value: ItemForm[K]) {
    setItems((p) => p.map((item, i) => (i === idx ? { ...item, [key]: value } : item)));
  }

  function getProduct(id: string): ProductResponseDTO | undefined {
    return products.find((p) => p.id === id);
  }

  function getClientCustomPrice(productId: string): number | null {
    const cp = clientPrices.find((p) => p.productId === productId);
    return cp ? cp.customPrice : null;
  }

  function getItemUnitPrice(item: ItemForm): number {
    const p = getProduct(item.productId);
    if (!p) return 0;
    const custom = getClientCustomPrice(item.productId);
    if (custom !== null) return custom;
    if (p.type === 'GAS') return p.basePrice;
    if (!isDelivery && selectedClient?.clientType === 'RETAIL') {
      return Math.max(0, p.basePrice - 0.5);
    }
    return p.basePrice;
  }

  function buildTotal(): number {
    return items.reduce((sum, item) => {
      if (!item.productId) return sum;
      return sum + getItemUnitPrice(item) * item.quantity;
    }, 0);
  }

  const currentTotal = buildTotal();

  // Auto-sync payment amount with total when not manually edited
  useEffect(() => {
    if (paymentAmountAutoSync.current && registerPayment) {
      setPaymentAmount(currentTotal > 0 ? currentTotal.toFixed(2) : '');
    }
  }, [currentTotal, registerPayment]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!http) return;

    const validItems = items.filter((i) => i.productId && i.quantity > 0);
    if (validItems.length === 0) {
      setError('Adicione pelo menos um item ao pedido.');
      return;
    }

    setSubmitting(true);
    setError(null);

    let clientId: string;

    if (isAvulso) {
      try {
        const params = avulsoName.trim() ? { name: avulsoName.trim() } : undefined;
        const res = await http.post<ClientResponseDTO>('/clients/avulso', null, { params });
        clientId = res.data.id;
      } catch {
        setError('Erro ao criar cliente avulso. Tente novamente.');
        setSubmitting(false);
        return;
      }
    } else if (selectedClient) {
      clientId = selectedClient.id;
    } else {
      setError('Selecione um cliente para continuar.');
      setSubmitting(false);
      return;
    }

    const orderItems: OrderItemRequestBody[] = validItems.map((item) => {
      const p = getProduct(item.productId);
      const base: OrderItemRequestBody = { productId: item.productId, quantity: item.quantity };
      if (item.bottleExpiration) base.bottleExpiration = item.bottleExpiration;
      if (p?.type === 'GAS') {
        if (item.supplierId) base.supplierId = item.supplierId;
        if (item.gasCostPrice) base.gasCostPrice = parseFloat(item.gasCostPrice);
        base.receivedByUs = item.receivedByUs;
      }
      return base;
    });

    const body: OrderRequestBody = {
      clientId,
      items: orderItems,
      isDelivery,
      deliveryDate: deliveryDate ? `${deliveryDate}:00` : undefined,
    };

    try {
      const orderRes = await http.post<{ id: string }[]>('/orders', body);
      const newOrderId = orderRes.data[0]?.id;

      if (registerPayment && paymentAmount) {
        const amount = parseFloat(paymentAmount);
        if (!isNaN(amount) && amount > 0) {
          await http.post('/payments', {
            paymentDate: nowPaymentDate(),
            amount,
            orderId: newOrderId,
            paymentMethod,
          });
        }
      }

      onSuccess();
      onClose();
    } catch {
      setError('Erro ao criar pedido. Verifique os dados e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'w-full border border-slate-200 rounded-lg bg-white text-[13px] py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-700 placeholder-slate-400';
  const cellInputClass =
    'w-full border border-slate-200 rounded bg-white text-[13px] py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all text-slate-700';

  const isOverdue = selectedClient && selectedClient.balance < 0;
  const isRetail = selectedClient?.clientType === 'RETAIL';
  const hasGasItem = items.some((item) => getProduct(item.productId)?.type === 'GAS');

  return (
    <>
      <Modal open={open} onClose={onClose} title="Novo Pedido" maxWidth="max-w-5xl">
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[82vh]">

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
                <span className="text-[13px] font-medium">{error}</span>
              </div>
            )}

            {/* ── Cliente + Data ── */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Cliente *
                </label>
                <div className="relative">
                  <button
                    type="button"
                    disabled={isAvulso}
                    onClick={() => { setShowDropdown(true); searchClients(clientSearch, true); }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors z-10 disabled:opacity-40 disabled:cursor-default"
                    tabIndex={-1}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>search</span>
                  </button>
                  <input
                    type="text"
                    value={isAvulso ? avulsoName : clientSearch}
                    onChange={(e) => {
                      if (isAvulso) {
                        setAvulsoName(e.target.value);
                      } else {
                        setClientSearch(e.target.value);
                        setSelectedClient(null);
                        setShowDropdown(true);
                      }
                    }}
                    onFocus={() => {
                      if (!isAvulso) {
                        setShowDropdown(true);
                        if (!clientSearch) searchClients('', true);
                      }
                    }}
                    placeholder={isAvulso ? 'Nome do cliente (opcional)' : 'Buscar cliente...'}
                    className={`${inputClass} pl-9 pr-28`}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isAvulso;
                      setIsAvulso(next);
                      setSelectedClient(null);
                      setClientSearch('');
                      if (next) {
                        setClientResults([]);
                        setShowDropdown(false);
                      }
                    }}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all ${
                      isAvulso
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'border-slate-200 text-slate-500 hover:border-primary hover:text-primary bg-white'
                    }`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                      {isAvulso ? 'person_off' : 'person_add'}
                    </span>
                    {isAvulso ? 'Avulso ✓' : 'Avulso'}
                  </button>

                  {!isAvulso && showDropdown && (clientResults.length > 0 || searchLoading) && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg z-20 mt-1 overflow-hidden max-h-56 overflow-y-auto">
                      {searchLoading && (
                        <div className="px-4 py-3 text-[13px] text-slate-400">Buscando...</div>
                      )}
                      {clientResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectClient(c)}
                          className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex justify-between items-center"
                        >
                          <div>
                            <p className="font-semibold text-[13px] text-slate-800">{c.name}</p>
                            <p className="text-[11px] text-slate-500">
                              {c.clientType === 'RETAIL' ? 'Varejo' : 'Revendedor'}
                            </p>
                          </div>
                          <span className={`text-[12px] font-bold ${c.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatBRL(c.balance)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {isOverdue && (
                  <div className="mt-1.5 flex items-center gap-2 p-2 bg-red-50 text-red-700 rounded-lg border border-red-200">
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>warning</span>
                    <span className="text-[12px] font-bold">
                      CLIENTE INADIMPLENTE — Saldo devedor: {formatBRL(Math.abs(selectedClient.balance))}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Data de Entrega / Retirada
                </label>
                <input
                  type="datetime-local"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {/* ── Tipo de Pedido ── */}
            <div className="flex items-center gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider mr-1">Tipo:</span>
              <button
                type="button"
                onClick={() => setIsDelivery(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-bold text-[13px] transition-all ${
                  isDelivery
                    ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                    : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300'
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>local_shipping</span>
                Entrega
              </button>
              <button
                type="button"
                onClick={() => setIsDelivery(false)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-bold text-[13px] transition-all ${
                  !isDelivery
                    ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                    : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300'
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>shopping_bag</span>
                Retirada pelo Cliente
              </button>
              {!isDelivery && isRetail && (
                <span className="ml-auto text-[12px] text-primary font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>local_offer</span>
                  Desconto R$ 0,50/galão (varejo)
                </span>
              )}
            </div>

            {/* ── Itens do Pedido ── */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Itens do Pedido *
                </label>
                <button
                  type="button"
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
                      <th className="px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-36">Val. Vasilhame</th>
                      {hasGasItem && (
                        <th className="px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-36">Fornecedor</th>
                      )}
                      <th className="px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-28">Preço Unit.</th>
                      {hasGasItem && (
                        <th className="px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-24 text-center">Recebido</th>
                      )}
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => {
                      const product = getProduct(item.productId);
                      const isGas = product?.type === 'GAS';
                      const unitPrice = getItemUnitPrice(item);
                      const customPrice = item.productId ? getClientCustomPrice(item.productId) : null;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/60">
                          <td className="px-3 py-2">
                            <select
                              required
                              value={item.productId}
                              onChange={(e) => updateItem(idx, 'productId', e.target.value)}
                              className={cellInputClass}
                            >
                              <option value="">Selecionar produto...</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              required
                              min={1}
                              value={item.quantity}
                              onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                              className={cellInputClass + ' text-center'}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="date"
                              value={item.bottleExpiration}
                              onChange={(e) => updateItem(idx, 'bottleExpiration', e.target.value)}
                              className={cellInputClass}
                            />
                          </td>
                          {hasGasItem && (
                            <td className="px-3 py-2">
                              {isGas ? (
                                <select
                                  value={item.supplierId}
                                  onChange={(e) => updateItem(idx, 'supplierId', e.target.value)}
                                  className={cellInputClass}
                                >
                                  <option value="">Padrão do produto</option>
                                  {suppliers.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-[13px] text-slate-400 px-1">—</span>
                              )}
                            </td>
                          )}
                          <td className="px-3 py-2">
                            {isGas ? (
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                value={item.gasCostPrice}
                                onChange={(e) => updateItem(idx, 'gasCostPrice', e.target.value)}
                                placeholder="Custo"
                                className={cellInputClass + ' text-right'}
                              />
                            ) : (
                              <div className="px-1">
                                <span className={`text-[13px] font-bold ${!isDelivery && isRetail && !customPrice ? 'text-primary' : customPrice ? 'text-amber-600' : 'text-slate-800'}`}>
                                  {item.productId ? formatBRL(unitPrice) : '—'}
                                </span>
                                {customPrice !== null && item.productId && (
                                  <p className="text-[10px] text-amber-600 font-bold leading-none mt-0.5">★ preço especial</p>
                                )}
                              </div>
                            )}
                          </td>
                          {hasGasItem && (
                            <td className="px-3 py-2 text-center">
                              {isGas ? (
                                <input
                                  type="checkbox"
                                  checked={item.receivedByUs}
                                  onChange={(e) => updateItem(idx, 'receivedByUs', e.target.checked)}
                                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer"
                                />
                              ) : (
                                <span className="text-slate-400 text-[13px]">—</span>
                              )}
                            </td>
                          )}
                          <td className="px-2 py-2">
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeItem(idx)}
                                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Fidelidade + Resumo ── */}
            <div className="grid grid-cols-2 gap-4">
              {/* Fidelidade */}
              <div className={`rounded-xl p-4 border ${selectedClient ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-amber-500" style={{ fontSize: '18px' }}>workspace_premium</span>
                  <span className="font-semibold text-[13px] text-slate-700">Fidelidade do Cliente</span>
                </div>
                {selectedClient ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xl font-black text-amber-600">
                        {selectedClient.fidelityPoints.toLocaleString('pt-BR')} pts
                      </p>
                      {selectedClient.pendingBonusWater > 0 && (
                        <p className="text-[11px] text-amber-700 mt-0.5">
                          {selectedClient.pendingBonusWater} galão(ões) bônus disponível
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddPoints(true)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white rounded-lg text-[12px] font-bold hover:brightness-110 transition-all"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>add_circle</span>
                      Dar Pontos
                    </button>
                  </div>
                ) : (
                  <p className="text-[13px] text-slate-500">Selecione um cliente para ver fidelidade</p>
                )}
              </div>

              {/* Resumo do pedido */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '18px' }}>receipt_long</span>
                  <span className="font-semibold text-[13px] text-slate-700">Resumo do Pedido</span>
                </div>
                {items.some((i) => i.productId) ? (
                  <div className="space-y-1.5">
                    {items.filter((i) => i.productId).map((item, idx) => {
                      const p = getProduct(item.productId);
                      if (!p) return null;
                      const price = getItemUnitPrice(item);
                      return (
                        <div key={idx} className="flex justify-between items-center text-[13px]">
                          <span className="text-slate-500">{p.name} × {item.quantity}</span>
                          <span className="font-semibold text-slate-700">{formatBRL(price * item.quantity)}</span>
                        </div>
                      );
                    })}
                    <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-2">
                      <span className="font-bold text-slate-700 text-[13px]">Total Estimado</span>
                      <span className="text-lg font-black text-primary">{formatBRL(currentTotal)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[13px] text-slate-400 text-center py-2">Adicione itens para ver o total</p>
                )}
              </div>
            </div>

            {/* ── Pagamento ── */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '18px' }}>payments</span>
                  <span className="font-semibold text-[13px] text-slate-700">Pagamento</span>
                  <span className="text-[11px] text-slate-400 font-medium">(opcional)</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-[12px] text-slate-500 font-medium">Registrar agora</span>
                  <div
                    onClick={() => setRegisterPayment((v) => !v)}
                    className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${registerPayment ? 'bg-primary' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${registerPayment ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </label>
              </div>

              <div className={`p-4 transition-all ${registerPayment ? '' : 'opacity-50 pointer-events-none'}`}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Valor (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={paymentAmount}
                      onChange={(e) => {
                        paymentAmountAutoSync.current = false;
                        setPaymentAmount(e.target.value);
                      }}
                      placeholder="0,00"
                      className={inputClass}
                    />
                    {currentTotal > 0 && paymentAmount && parseFloat(paymentAmount) < currentTotal && (
                      <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>info</span>
                        Pagamento parcial — restam {formatBRL(currentTotal - parseFloat(paymentAmount))}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Forma de Pagamento
                    </label>
                    <div className="flex gap-2">
                      {PAYMENT_METHODS.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setPaymentMethod(m.value)}
                          className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border text-[11px] font-bold transition-all ${
                            paymentMethod === m.value
                              ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                              : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{m.icon}</span>
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ── Footer ── */}
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
              disabled={submitting || (!selectedClient && !isAvulso)}
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
                  Salvar Pedido
                </>
              )}
            </button>
          </div>

        </form>
      </Modal>

      {selectedClient && (
        <AddFidelityPointsModal
          open={showAddPoints}
          onClose={() => setShowAddPoints(false)}
          onSuccess={() => setShowAddPoints(false)}
          clientId={selectedClient.id}
          clientName={selectedClient.name}
        />
      )}
    </>
  );
}
