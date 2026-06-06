import { useState, useEffect, useRef, type FormEvent, useCallback } from 'react';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { parseApiError } from '../utils/parseApiError';
import { ORDER_DRAFT_KEY, clearOrderDraft } from '../utils/orderDraft';
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
  SystemConfigDTO,
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
  useBonus: boolean;
}

interface NewOrderModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultClient?: ClientResponseDTO;
  editOrder?: import('../types').OrderResponseDTO;
}

const emptyItem = (): ItemForm => ({
  productId: '',
  quantity: 1,
  supplierId: '',
  gasCostPrice: '',
  receivedByUs: false,
  bottleExpiration: '',
  useBonus: false,
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

export function NewOrderModal({ open, onClose, onSuccess, defaultClient, editOrder }: NewOrderModalProps) {
  const isEditMode = !!editOrder;
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
  const [sysConfig, setSysConfig] = useState<SystemConfigDTO | null>(null);
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
      setClientPrices([]);
      paymentAmountAutoSync.current = true;

      if (editOrder) {
        // Edit mode: pre-populate from existing order
        setIsAvulso(false);
        setAvulsoName('');
        setRegisterPayment(true);
        setPaymentAmount('');
        setPaymentMethod('PIX');
        setIsDelivery(editOrder.isDelivery ?? true);
        setDeliveryDate(editOrder.deliveryDate
          ? (() => {
              const d = new Date(editOrder.deliveryDate!);
              const pad = (n: number) => String(n).padStart(2, '0');
              return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            })()
          : nowDatetimeLocal());
        setItems(editOrder.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          supplierId: i.supplierId ?? '',
          gasCostPrice: i.gasCostPrice?.toString() ?? '',
          receivedByUs: i.receivedByUs ?? false,
          bottleExpiration: i.bottleExpiration ?? '',
          useBonus: i.unitPrice === 0,
        })));
        setSelectedClient(null);
        setClientSearch(editOrder.clientName);
      } else {
        // New order: try to restore draft first
        const rawDraft = localStorage.getItem(ORDER_DRAFT_KEY);
        const draft = rawDraft ? (() => { try { return JSON.parse(rawDraft); } catch { return null; } })() : null;
        if (draft) {
          setItems(draft.items ?? [emptyItem()]);
          setSelectedClient(draft.selectedClient ?? null);
          setClientSearch(draft.clientSearch ?? '');
          setIsAvulso(draft.isAvulso ?? false);
          setAvulsoName(draft.avulsoName ?? '');
          setIsDelivery(draft.isDelivery ?? true);
          setDeliveryDate(draft.deliveryDate ?? nowDatetimeLocal());
          setPaymentMethod(draft.paymentMethod ?? 'PIX');
          setRegisterPayment(draft.registerPayment ?? true);
          setPaymentAmount(draft.paymentAmount ?? '');
        } else {
          setItems([emptyItem()]);
          setIsDelivery(true);
          setDeliveryDate(nowDatetimeLocal());
          setIsAvulso(false);
          setAvulsoName('');
          setRegisterPayment(true);
          setPaymentAmount('');
          setPaymentMethod('PIX');
          if (defaultClient) {
            setSelectedClient(defaultClient);
            setClientSearch(defaultClient.name);
          } else {
            setSelectedClient(null);
            setClientSearch('');
          }
        }
      }
    }
  }, [open, defaultClient, editOrder]);

  useEffect(() => {
    if (!http || !open) return;
    Promise.all([
      http.get<SpringPage<ProductResponseDTO>>('/products', { params: { size: 100 } }),
      http.get<SpringPage<GasSupplierResponseDTO>>('/suppliers', { params: { size: 100 } }),
      http.get<SystemConfigDTO>('/config'),
    ])
      .then(([prodRes, suppRes, cfgRes]) => {
        setProducts(prodRes.data.content.filter((p) => p.isActive));
        setSuppliers(suppRes.data.content);
        setSysConfig(cfgRes.data);
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

  function handleBonusToggle(idx: number, item: ItemForm, available: number) {
    if (item.useBonus) {
      // Remove the bonus row entirely
      removeItem(idx);
      return;
    }
    if (available <= 0) return;
    // Always add a separate bonus row (qty=1) after the paid row
    setItems((prev) => {
      const bonusRow: ItemForm = { ...prev[idx], quantity: 1, useBonus: true };
      return [...prev.slice(0, idx + 1), bonusRow, ...prev.slice(idx + 1)];
    });
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
    // Reseller price (applied server-side; shown client-side for preview)
    if (selectedClient?.clientType === 'RESELLER' && p.resellerPrice) return p.resellerPrice;
    if (!isDelivery && selectedClient?.clientType === 'RETAIL') {
      return Math.max(0, p.basePrice - 0.5);
    }
    return p.basePrice;
  }

  function getPriceSource(item: ItemForm): 'custom' | 'reseller' | 'discount' | 'base' {
    const p = getProduct(item.productId);
    if (!p || !item.productId) return 'base';
    if (getClientCustomPrice(item.productId) !== null) return 'custom';
    if (selectedClient?.clientType === 'RESELLER' && p.resellerPrice) return 'reseller';
    if (!isDelivery && selectedClient?.clientType === 'RETAIL') return 'discount';
    return 'base';
  }

  function buildTotal(): number {
    return items.reduce((sum, item) => {
      if (!item.productId || item.useBonus) return sum;
      return sum + getItemUnitPrice(item) * item.quantity;
    }, 0);
  }

  function bonusesUsedInOrder(): number {
    return items.reduce((sum, item) => {
      if (!item.productId || !item.useBonus) return sum;
      const p = getProduct(item.productId);
      if (p?.type !== 'WATER') return sum;
      return sum + item.quantity;
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

    if (isEditMode) {
      clientId = editOrder!.clientId;
    } else if (isAvulso) {
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
      if (item.useBonus && p?.type === 'WATER') base.unitPrice = 0;
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
      if (isEditMode) {
        await http.put(`/orders/${editOrder!.id}`, body);
      } else {
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
      }

      clearOrderDraft();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(parseApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'w-full border border-slate-200 rounded-lg bg-white text-[13px] py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-700 placeholder-slate-400';
  const cellInputClass =
    'w-full border border-slate-200 rounded bg-white text-[13px] py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all text-slate-700';

  function saveDraftAndClose() {
    if (!isEditMode) {
      const draft = { items, selectedClient, clientSearch, isAvulso, avulsoName, isDelivery, deliveryDate, paymentMethod, registerPayment, paymentAmount };
      try { localStorage.setItem(ORDER_DRAFT_KEY, JSON.stringify(draft)); } catch { /* noop */ }
    }
    onClose();
  }

  function handleCancel() {
    clearOrderDraft();
    onClose();
  }

  const isOverdue = selectedClient && selectedClient.balance < 0;
  const isRetail = selectedClient?.clientType === 'RETAIL';
  const hasGasItem = items.some((item) => getProduct(item.productId)?.type === 'GAS');

  // Projected available bonuses: existing + what this order will earn
  const ptPerItem = sysConfig?.pointsPerWaterItem ?? 1;
  const ptPerFree = sysConfig?.pointsPerFreeWater ?? 10;
  const paidWaterQtyInOrder = selectedClient
    ? items.reduce((sum, item) => {
        if (!item.productId || item.useBonus) return sum;
        const p = getProduct(item.productId);
        return p?.type === 'WATER' ? sum + item.quantity : sum;
      }, 0)
    : 0;
  const projectedRawPoints = (selectedClient?.fidelityPoints ?? 0) + paidWaterQtyInOrder * ptPerItem;
  const projectedBonusWater = selectedClient ? Math.floor(projectedRawPoints / ptPerFree) : 0;
  const showBonusColumn =
    selectedClient?.clientType !== 'RESELLER' &&
    selectedClient != null &&
    (selectedClient.pendingBonusWater > 0 || projectedBonusWater > 0 || bonusesUsedInOrder() > 0);

  return (
    <>
      <Modal open={open} onClose={isEditMode ? onClose : saveDraftAndClose} title={isEditMode ? `Editar Pedido` : 'Novo Pedido'} maxWidth="max-w-5xl">
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
                  Cliente {!isEditMode && '*'}
                </label>
                {isEditMode ? (
                  <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg bg-slate-50">
                    <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '16px' }}>person</span>
                    <span className="text-[13px] font-semibold text-slate-700">{editOrder?.clientName}</span>
                    <span className="ml-auto text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">bloqueado</span>
                  </div>
                ) : (
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
                          className={`w-full text-left px-4 py-2.5 transition-colors flex justify-between items-center ${
                            c.clientType === 'RESELLER'
                              ? 'hover:bg-amber-50 border-l-2 border-amber-400'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div>
                            <p className={`font-semibold text-[13px] ${c.clientType === 'RESELLER' ? 'text-amber-800' : 'text-slate-800'}`}>
                              {c.name}
                            </p>
                            <p className={`text-[11px] font-medium ${c.clientType === 'RESELLER' ? 'text-amber-600' : 'text-slate-500'}`}>
                              {c.clientType === 'RETAIL' ? 'Varejo' : '★ Revendedor'}
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
                )}

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
                      {showBonusColumn && (
                        <th className="px-3 py-2.5 text-[11px] font-semibold text-green-600 uppercase tracking-wider w-24 text-center">Usar Bônus</th>
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
                                {item.useBonus ? (
                                  <span className="text-[12px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                                    BÔNUS
                                  </span>
                                ) : (() => {
                                    const src = getPriceSource(item);
                                    const colorMap: Record<string, string> = { custom: 'text-amber-600', reseller: 'text-violet-700', discount: 'text-primary', base: 'text-slate-800' };
                                    const badgeMap: Record<string, string | null> = { custom: '★ preço especial', reseller: '⬟ revenda', discount: '↓ desconto retirada', base: null };
                                    return (
                                      <>
                                        <span className={`text-[13px] font-bold ${colorMap[src]}`}>
                                          {item.productId ? formatBRL(unitPrice) : '—'}
                                        </span>
                                        {badgeMap[src] && item.productId && (
                                          <p className={`text-[10px] font-bold leading-none mt-0.5 ${colorMap[src]}`}>{badgeMap[src]}</p>
                                        )}
                                      </>
                                    );
                                  })()}
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
                          {showBonusColumn && (() => {
                            const isWater = getProduct(item.productId)?.type === 'WATER';
                            const netAvailable = projectedBonusWater - bonusesUsedInOrder() + (item.useBonus ? item.quantity : 0);
                            const canToggle = isWater && !!item.productId && (item.useBonus || netAvailable >= 1);
                            return (
                              <td className="px-3 py-2 text-center">
                                {isWater && item.productId ? (
                                  <button
                                    type="button"
                                    disabled={!canToggle}
                                    onClick={() => handleBonusToggle(idx, item, netAvailable)}
                                    title={item.useBonus ? 'Remover bônus' : canToggle ? 'Usar bônus (galão grátis)' : 'Bônus insuficiente'}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                      item.useBonus
                                        ? 'bg-green-500 text-white border-green-500'
                                        : canToggle
                                        ? 'bg-white border-green-400 text-green-700 hover:bg-green-50'
                                        : 'bg-white border-slate-200 text-slate-300 cursor-not-allowed'
                                    }`}
                                  >
                                    {item.useBonus ? '✓ Bônus' : 'Resgatar'}
                                  </button>
                                ) : (
                                  <span className="text-slate-300 text-[13px]">—</span>
                                )}
                              </td>
                            );
                          })()}
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
            <div className={`grid gap-4 ${selectedClient?.clientType !== 'RESELLER' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {/* Fidelidade — oculta para Revendedor */}
              {selectedClient?.clientType !== 'RESELLER' && <div className={`rounded-xl p-4 border ${selectedClient ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-amber-500" style={{ fontSize: '18px' }}>workspace_premium</span>
                  <span className="font-semibold text-[13px] text-slate-700">Fidelidade do Cliente</span>
                </div>
                {selectedClient ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xl font-black text-amber-600">
                          {selectedClient.fidelityPoints.toLocaleString('pt-BR')} pts
                        </p>
                        <p className="text-[11px] text-amber-700/70 mt-0.5">
                          +{sysConfig?.pointsPerWaterItem ?? '?'} pt por galão de água
                        </p>
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
                    {(() => {
                      const total = projectedBonusWater;
                      const used = bonusesUsedInOrder();
                      const remaining = total - used;
                      if (total === 0) return null;
                      return (
                        <div className={`flex items-center gap-2 p-2 rounded-lg border text-[12px] font-semibold ${
                          used > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'
                        }`}>
                          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>redeem</span>
                          {total} galão(ões) bônus disponível{paidWaterQtyInOrder > 0 && selectedClient.pendingBonusWater < total ? ' (inclui projetados)' : ''}
                          {used > 0 && <span className="ml-auto">{used} resgatado(s) · {remaining} restante(s)</span>}
                        </div>
                      );
                    })()}
                    {paidWaterQtyInOrder > 0 && (() => {
                      const earned = paidWaterQtyInOrder * ptPerItem;
                      const gainedNewBonuses = projectedBonusWater > selectedClient.pendingBonusWater;
                      return (
                        <div className="flex items-center gap-2 p-2 rounded-lg border bg-blue-50 border-blue-200 text-blue-700 text-[12px] font-semibold">
                          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>trending_up</span>
                          <span>Este pedido vai gerar <b>+{earned} pt</b></span>
                          {gainedNewBonuses && (
                            <span className="ml-auto text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 text-[11px]">
                              atingirá {projectedBonusWater} bônus
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="text-[13px] text-slate-500">Selecione um cliente para ver fidelidade</p>
                )}
              </div>}

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
                          <span className="text-slate-500">
                            {p.name} × {item.quantity}
                            {item.useBonus && <span className="ml-1.5 text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-200">BÔNUS</span>}
                          </span>
                          <span className={`font-semibold ${item.useBonus ? 'text-green-600 line-through decoration-1' : 'text-slate-700'}`}>
                            {item.useBonus ? formatBRL(price * item.quantity) : formatBRL(price * item.quantity)}
                          </span>
                          {item.useBonus && <span className="font-bold text-green-600 ml-1">R$ 0,00</span>}
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

            {/* ── Pagamento (apenas no modo criação) ── */}
            {!isEditMode && <div className="border border-slate-200 rounded-xl overflow-hidden">
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
            </div>}

          </div>

          {/* ── Footer ── */}
          <div className="flex gap-3 justify-end px-6 py-4 border-t border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={isEditMode ? onClose : handleCancel}
              disabled={submitting}
              className="px-5 py-2.5 border border-slate-200 rounded-lg font-semibold text-[13px] text-slate-600 hover:bg-white transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || (!isEditMode && !selectedClient && !isAvulso)}
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
                  {isEditMode ? 'Salvar Alterações' : 'Salvar Pedido'}
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
          onSuccess={() => {
            setShowAddPoints(false);
            if (http && selectedClient) {
              http.get<import('../types').ClientResponseDTO>(`/clients/${selectedClient.id}`)
                .then((r) => setSelectedClient(r.data))
                .catch(() => {});
            }
          }}
          clientId={selectedClient.id}
          clientName={selectedClient.name}
        />
      )}
    </>
  );
}
