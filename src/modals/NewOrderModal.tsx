import { useState, useEffect, type FormEvent, useCallback } from 'react';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import type {
  ClientResponseDTO,
  ProductResponseDTO,
  SpringPage,
  OrderItemRequestBody,
  OrderRequestBody,
} from '../types';
import { formatBRL } from '../utils/format';

interface ItemForm {
  productId: string;
  quantity: number;
  gasCostPrice: string;
  receivedByUs: boolean;
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
  gasCostPrice: '',
  receivedByUs: false,
});

export function NewOrderModal({ open, onClose, onSuccess, defaultClient }: NewOrderModalProps) {
  const { http } = useAuth();

  const [selectedClient, setSelectedClient] = useState<ClientResponseDTO | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<ClientResponseDTO[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const [products, setProducts] = useState<ProductResponseDTO[]>([]);
  const [items, setItems] = useState<ItemForm[]>([emptyItem()]);

  const [isDelivery, setIsDelivery] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setItems([emptyItem()]);
      setIsDelivery(false);
      setDeliveryDate('');
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
    http
      .get<SpringPage<ProductResponseDTO>>('/products', { params: { size: 100 } })
      .then((res) => setProducts(res.data.content.filter((p) => p.isActive)))
      .catch(() => setProducts([]));
  }, [http, open]);

  const searchClients = useCallback(
    async (query: string) => {
      if (!http || query.length < 2) {
        setClientResults([]);
        return;
      }
      setSearchLoading(true);
      try {
        const res = await http.get<SpringPage<ClientResponseDTO>>('/clients', {
          params: { name: query, size: 6 },
        });
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
    const timer = setTimeout(() => searchClients(clientSearch), 350);
    return () => clearTimeout(timer);
  }, [clientSearch, searchClients]);

  function selectClient(c: ClientResponseDTO) {
    setSelectedClient(c);
    setClientSearch(c.name);
    setShowDropdown(false);
    setClientResults([]);
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem<K extends keyof ItemForm>(idx: number, key: K, value: ItemForm[K]) {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [key]: value } : item)));
  }

  function getProduct(productId: string): ProductResponseDTO | undefined {
    return products.find((p) => p.id === productId);
  }

  function buildTotal(): number {
    return items.reduce((sum, item) => {
      const p = getProduct(item.productId);
      if (!p) return sum;
      return sum + p.basePrice * item.quantity;
    }, 0);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!http || !selectedClient) return;

    const validItems = items.filter((i) => i.productId && i.quantity > 0);
    if (validItems.length === 0) {
      setError('Adicione pelo menos um item ao pedido.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const orderItems: OrderItemRequestBody[] = validItems.map((item) => {
      const p = getProduct(item.productId);
      const base: OrderItemRequestBody = { productId: item.productId, quantity: item.quantity };
      if (p?.type === 'GAS') {
        if (item.gasCostPrice) base.gasCostPrice = parseFloat(item.gasCostPrice);
        base.receivedByUs = item.receivedByUs;
      }
      return base;
    });

    const body: OrderRequestBody = {
      clientId: selectedClient.id,
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

  const labelClass = 'block text-label-sm text-on-surface-variant mb-1';

  const isOverdue = selectedClient && selectedClient.balance < 0;

  return (
    <Modal open={open} onClose={onClose} title="Novo Pedido" maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-error-container text-on-error-container rounded-lg">
            <span className="material-symbols-outlined text-error" style={{ fontSize: '18px' }}>
              error
            </span>
            <span className="text-label-sm">{error}</span>
          </div>
        )}

        {/* Client search */}
        <div>
          <label className={labelClass}>Cliente *</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" style={{ fontSize: '20px' }}>
              search
            </span>
            <input
              type="text"
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value);
                setSelectedClient(null);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Buscar cliente pelo nome..."
              className={`${inputClass} pl-10`}
              autoComplete="off"
            />
            {showDropdown && (clientResults.length > 0 || searchLoading) && (
              <div className="absolute top-full left-0 right-0 bg-surface border border-outline-variant rounded-lg shadow-lg z-10 mt-1 overflow-hidden">
                {searchLoading && (
                  <div className="px-4 py-3 text-body-md text-on-surface-variant">Buscando...</div>
                )}
                {clientResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectClient(c)}
                    className="w-full text-left px-4 py-3 hover:bg-surface-container-low transition-colors flex justify-between items-center"
                  >
                    <div>
                      <p className="font-bold text-body-md text-on-surface">{c.name}</p>
                      <p className="text-label-sm text-on-surface-variant">{c.clientType}</p>
                    </div>
                    <span
                      className={`text-label-sm font-bold ${c.balance < 0 ? 'text-error' : 'text-green-600'}`}
                    >
                      {formatBRL(c.balance)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {isOverdue && (
            <div className="mt-2 flex items-center gap-2 p-3 bg-error-container text-on-error-container rounded-lg">
              <span className="material-symbols-outlined text-error" style={{ fontSize: '18px' }}>
                warning
              </span>
              <span className="text-label-sm font-bold">
                CLIENTE INADIMPLENTE — Saldo devedor: {formatBRL(Math.abs(selectedClient.balance))}
              </span>
            </div>
          )}
        </div>

        {/* Items */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className={labelClass}>Itens do Pedido *</label>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 text-primary font-bold text-label-sm hover:underline"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
              Adicionar item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => {
              const product = getProduct(item.productId);
              const isGas = product?.type === 'GAS';
              return (
                <div key={idx} className="bg-surface-container-low border border-outline-variant rounded-lg p-4">
                  <div className="flex gap-3 items-start">
                    <div className="flex-1">
                      <select
                        required
                        value={item.productId}
                        onChange={(e) => updateItem(idx, 'productId', e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Selecionar produto...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — {formatBRL(p.basePrice)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-24">
                      <input
                        required
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                        placeholder="Qtd"
                        className={inputClass}
                      />
                    </div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="p-2 text-error hover:bg-error/10 rounded-lg mt-0.5"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                      </button>
                    )}
                  </div>

                  {isGas && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Custo do Gás (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={item.gasCostPrice}
                          onChange={(e) => updateItem(idx, 'gasCostPrice', e.target.value)}
                          placeholder="Preço de custo"
                          className={inputClass}
                        />
                      </div>
                      <div className="flex items-end pb-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.receivedByUs}
                            onChange={(e) => updateItem(idx, 'receivedByUs', e.target.checked)}
                            className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary/20"
                          />
                          <span className="text-body-md text-on-surface">Recebido por nós</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {product && (
                    <p className="mt-2 text-label-sm text-on-surface-variant">
                      Subtotal estimado: {formatBRL(product.basePrice * item.quantity)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Delivery options */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 bg-surface-container-low border border-outline-variant rounded-lg p-4">
            <input
              type="checkbox"
              id="isDelivery"
              checked={isDelivery}
              onChange={(e) => setIsDelivery(e.target.checked)}
              className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary/20"
            />
            <label htmlFor="isDelivery" className="text-body-md text-on-surface cursor-pointer font-bold">
              Entrega
            </label>
          </div>
          <div>
            <label className={labelClass}>Data de Entrega</label>
            <input
              type="datetime-local"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Total summary */}
        {selectedClient && items.some((i) => i.productId) && (
          <div className="bg-surface-container p-4 rounded-xl flex justify-between items-center">
            <span className="text-body-md text-on-surface-variant font-bold">Total Estimado</span>
            <span className="text-h2 text-primary font-black">{formatBRL(buildTotal())}</span>
          </div>
        )}

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
            disabled={submitting || !selectedClient}
            className="px-6 py-2.5 bg-primary text-on-primary rounded-lg font-bold hover:brightness-110 transition-all disabled:opacity-70 flex items-center gap-2"
          >
            {submitting ? (
              'Criando...'
            ) : (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add_shopping_cart</span>
                Criar Pedido
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
