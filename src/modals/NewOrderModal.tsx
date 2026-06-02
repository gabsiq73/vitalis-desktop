import { useState, useEffect, type FormEvent, useCallback } from 'react';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { AddFidelityPointsModal } from './AddFidelityPointsModal';
import type {
  ClientResponseDTO,
  ProductResponseDTO,
  GasSupplierResponseDTO,
  SpringPage,
  OrderItemRequestBody,
  OrderRequestBody,
} from '../types';
import { formatBRL } from '../utils/format';

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
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });

  const [showAddPoints, setShowAddPoints] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setItems([emptyItem()]);
      setIsDelivery(true);
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      setDeliveryDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`);
      setIsAvulso(false);
      setAvulsoName('');
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
  }

  function addItem() { setItems((p) => [...p, emptyItem()]); }
  function removeItem(idx: number) { setItems((p) => p.filter((_, i) => i !== idx)); }
  function updateItem<K extends keyof ItemForm>(idx: number, key: K, value: ItemForm[K]) {
    setItems((p) => p.map((item, i) => (i === idx ? { ...item, [key]: value } : item)));
  }

  function getProduct(id: string): ProductResponseDTO | undefined {
    return products.find((p) => p.id === id);
  }

  function getItemUnitPrice(item: ItemForm): number {
    const p = getProduct(item.productId);
    if (!p) return 0;
    if (p.type === 'GAS') return p.basePrice;
    // Desconto de R$0,50 para retirada de clientes varejo sem preço especial
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
      deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : undefined,
    };

    try {
      await http.post('/orders', body);
      onSuccess();
      onClose();
    } catch {
      setError('Erro ao criar pedido. Verifique os dados e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'w-full border border-outline-variant rounded-lg bg-surface-container-low text-body-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';
  const cellInputClass =
    'w-full border border-outline-variant rounded bg-surface-container-low text-sm py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all';
  const labelClass = 'block text-label-sm text-on-surface-variant mb-1.5';

  const isOverdue = selectedClient && selectedClient.balance < 0;
  const isRetail = selectedClient?.clientType === 'RETAIL';

  return (
    <>
      <Modal open={open} onClose={onClose} title="Novo Pedido" maxWidth="max-w-5xl">
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-error-container text-on-error-container rounded-lg">
              <span className="material-symbols-outlined text-error" style={{ fontSize: '18px' }}>error</span>
              <span className="text-label-sm">{error}</span>
            </div>
          )}

          {/* Cliente + Data de Entrega */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className={labelClass}>Seleção de Cliente</label>
              <div className="relative">
                {/* Ícone busca */}
                <button
                  type="button"
                  disabled={isAvulso}
                  onClick={() => { setShowDropdown(true); searchClients(clientSearch, true); }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors z-10 disabled:opacity-40 disabled:cursor-default"
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>search</span>
                </button>

                {/* Input */}
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
                  placeholder={isAvulso ? 'Nome do cliente (opcional)' : 'Clique na lupa ou digite para buscar...'}
                  className={`${inputClass} pl-9 pr-32 ${isAvulso ? 'bg-tertiary/5 border-tertiary/40' : ''}`}
                  autoComplete="off"
                />

                {/* Botão avulso dentro do input */}
                <button
                  type="button"
                  onClick={() => {
                    const next = !isAvulso;
                    setIsAvulso(next);
                    setSelectedClient(null);
                    setClientSearch('');
                    if (next) {
                      searchClients('', true);
                      setShowDropdown(true);
                    } else {
                      setClientResults([]);
                      setShowDropdown(false);
                    }
                  }}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all ${
                    isAvulso
                      ? 'bg-tertiary text-on-tertiary border-tertiary'
                      : 'border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary bg-surface'
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                    {isAvulso ? 'person_off' : 'person_add'}
                  </span>
                  {isAvulso ? 'Avulso ✓' : 'Avulso'}
                </button>

                {/* Dropdown resultados */}
                {!isAvulso && showDropdown && (clientResults.length > 0 || searchLoading) && (
                  <div className="absolute top-full left-0 right-0 bg-surface border border-outline-variant rounded-lg shadow-lg z-10 mt-1 overflow-hidden max-h-64 overflow-y-auto">
                    {searchLoading && (
                      <div className="px-4 py-3 text-body-md text-on-surface-variant">Buscando...</div>
                    )}
                    {clientResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectClient(c)}
                        className="w-full text-left px-4 py-2.5 hover:bg-surface-container-low transition-colors flex justify-between items-center"
                      >
                        <div>
                          <p className="font-bold text-body-md text-on-surface">{c.name}</p>
                          <p className="text-label-sm text-on-surface-variant">
                            {c.clientType === 'RETAIL' ? 'Varejo' : 'Revendedor'}
                          </p>
                        </div>
                        <span className={`text-label-sm font-bold ${c.balance < 0 ? 'text-error' : 'text-green-600'}`}>
                          {formatBRL(c.balance)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {isOverdue && (
                <div className="mt-1.5 flex items-center gap-2 p-2 bg-error-container text-on-error-container rounded-lg">
                  <span className="material-symbols-outlined text-error" style={{ fontSize: '16px' }}>warning</span>
                  <span className="text-label-sm font-bold">
                    CLIENTE INADIMPLENTE — Saldo: {formatBRL(Math.abs(selectedClient.balance))}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className={labelClass}>Data de Entrega / Retirada</label>
              <input
                type="datetime-local"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Tipo de Pedido */}
          <div className="flex items-center gap-4 p-4 bg-surface-container rounded-xl">
            <span className="text-label-sm text-on-surface-variant font-semibold">Tipo de Pedido:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsDelivery(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-bold text-sm transition-all ${
                  isDelivery
                    ? 'bg-primary text-on-primary border-primary shadow-sm'
                    : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>local_shipping</span>
                Entrega
              </button>
              <button
                type="button"
                onClick={() => setIsDelivery(false)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-bold text-sm transition-all ${
                  !isDelivery
                    ? 'bg-primary text-on-primary border-primary shadow-sm'
                    : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>shopping_bag</span>
                Retirada pelo Cliente
              </button>
            </div>
            {!isDelivery && isRetail && (
              <span className="text-label-sm text-primary font-bold">
                ✓ Desconto de R$ 0,50/galão de água (varejo)
              </span>
            )}
          </div>

          {/* Itens do Pedido */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-label-sm text-on-surface-variant font-semibold">Itens do Pedido *</label>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 text-primary font-bold text-label-sm hover:underline"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add_circle</span>
                Adicionar Item
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-outline-variant">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="px-3 py-2.5 text-label-sm text-on-surface-variant font-semibold">Produto</th>
                    <th className="px-3 py-2.5 text-label-sm text-on-surface-variant font-semibold w-16 text-center">Qtd</th>
                    <th className="px-3 py-2.5 text-label-sm text-on-surface-variant font-semibold w-36">Val. Vasilhame</th>
                    <th className="px-3 py-2.5 text-label-sm text-on-surface-variant font-semibold w-36">Fornecedor</th>
                    <th className="px-3 py-2.5 text-label-sm text-on-surface-variant font-semibold w-28">Preço Unit.</th>
                    <th className="px-3 py-2.5 text-label-sm text-on-surface-variant font-semibold w-24 text-center">Recebido</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {items.map((item, idx) => {
                    const product = getProduct(item.productId);
                    const isGas = product?.type === 'GAS';
                    const unitPrice = getItemUnitPrice(item);
                    return (
                      <tr key={idx} className="hover:bg-surface-container-low/40">
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
                            <span className="text-sm text-on-surface-variant px-1">—</span>
                          )}
                        </td>
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
                            <span className={`text-sm px-1 font-bold ${!isDelivery && isRetail ? 'text-primary' : 'text-on-surface'}`}>
                              {item.productId ? formatBRL(unitPrice) : '—'}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {isGas ? (
                            <input
                              type="checkbox"
                              checked={item.receivedByUs}
                              onChange={(e) => updateItem(idx, 'receivedByUs', e.target.checked)}
                              className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary/20 cursor-pointer"
                            />
                          ) : (
                            <span className="text-on-surface-variant text-sm">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="p-1 text-error hover:bg-error/10 rounded"
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

          {/* Fidelidade + Resumo */}
          <div className="grid grid-cols-2 gap-6">
            {/* Fidelidade */}
            <div>
              {selectedClient ? (
                <div className="bg-surface-container rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-tertiary" style={{ fontSize: '20px' }}>
                      workspace_premium
                    </span>
                    <span className="font-bold text-sm text-on-surface">Fidelidade do Cliente</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-h3 font-black text-tertiary">
                        {selectedClient.fidelityPoints.toLocaleString('pt-BR')} pts
                      </p>
                      {selectedClient.pendingBonusWater > 0 && (
                        <p className="text-label-sm text-tertiary mt-0.5">
                          {selectedClient.pendingBonusWater} galão(ões) bônus disponível
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddPoints(true)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-tertiary text-on-tertiary rounded-lg text-label-sm font-bold hover:brightness-110 transition-all"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add_circle</span>
                      Dar Pontos
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-surface-container rounded-xl p-4 flex items-center gap-3 opacity-50">
                  <span className="material-symbols-outlined text-outline" style={{ fontSize: '20px' }}>
                    workspace_premium
                  </span>
                  <span className="text-sm text-on-surface-variant">Selecione um cliente para ver fidelidade</span>
                </div>
              )}
            </div>

            {/* Resumo */}
            <div className="flex flex-col justify-end">
              <div className="bg-surface-container rounded-xl p-4 space-y-3">
                {items.some((i) => i.productId) && (
                  <>
                    {items.filter((i) => i.productId).map((item, idx) => {
                      const p = getProduct(item.productId);
                      if (!p) return null;
                      const price = getItemUnitPrice(item);
                      return (
                        <div key={idx} className="flex justify-between items-center text-sm">
                          <span className="text-on-surface-variant">{p.name} × {item.quantity}</span>
                          <span className="text-on-surface font-bold">{formatBRL(price * item.quantity)}</span>
                        </div>
                      );
                    })}
                    <div className="flex justify-between items-center pt-3 border-t border-outline-variant">
                      <span className="font-bold text-on-surface">Total Estimado</span>
                      <span className="text-h2 text-primary font-black">{formatBRL(buildTotal())}</span>
                    </div>
                  </>
                )}
                {!items.some((i) => i.productId) && (
                  <p className="text-sm text-on-surface-variant text-center py-2">Adicione itens para ver o total</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-outline-variant">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-6 py-2.5 border border-outline-variant rounded-lg font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || (!selectedClient && !isAvulso)}
              className="px-6 py-2.5 bg-primary text-on-primary rounded-lg font-bold hover:brightness-110 transition-all disabled:opacity-70 flex items-center gap-2"
            >
              {submitting ? (
                'Salvando...'
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
