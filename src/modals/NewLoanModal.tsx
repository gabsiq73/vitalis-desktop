import { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import type { ClientResponseDTO, ProductResponseDTO, LoanedBottleRequestDTO, SpringPage } from '../types';

interface NewLoanModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function NewLoanModal({ open, onClose, onSuccess }: NewLoanModalProps) {
  const { http } = useAuth();
  const [clients, setClients] = useState<ClientResponseDTO[]>([]);
  const [products, setProducts] = useState<ProductResponseDTO[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [clientId, setClientId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loanDate, setLoanDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !http) return;
    setLoadingOptions(true);
    Promise.all([
      http.get<SpringPage<ClientResponseDTO>>('/clients', { params: { size: 200 } }),
      http.get<SpringPage<ProductResponseDTO>>('/products', { params: { size: 200 } }),
    ])
      .then(([clientsRes, productsRes]) => {
        setClients(clientsRes.data.content);
        setProducts(productsRes.data.content.filter((p) => p.isActive));
      })
      .finally(() => setLoadingOptions(false));
  }, [open, http]);

  function handleClose() {
    setClientId('');
    setProductId('');
    setQuantity(1);
    setLoanDate(new Date().toISOString().slice(0, 10));
    setError('');
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) { setError('Selecione um cliente.'); return; }
    if (!productId) { setError('Selecione um produto.'); return; }
    if (quantity < 1) { setError('Quantidade deve ser maior que zero.'); return; }
    setLoading(true);
    setError('');
    try {
      const payload: LoanedBottleRequestDTO = {
        clientId,
        productId,
        quantity,
        loanDate: `${loanDate}T00:00:00`,
      };
      await http!.post('/bottles', payload);
      onSuccess();
      handleClose();
    } catch {
      setError('Erro ao registrar empréstimo. Verifique os dados e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Registrar Novo Empréstimo" maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <div>
          <label className="block text-label-sm text-on-surface-variant uppercase mb-1.5">Cliente *</label>
          <select
            className="w-full px-4 py-2.5 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            disabled={loadingOptions}
          >
            <option value="">
              {loadingOptions ? 'Carregando clientes...' : 'Selecione um cliente...'}
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-label-sm text-on-surface-variant uppercase mb-1.5">Produto *</label>
            <select
              className="w-full px-4 py-2.5 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              disabled={loadingOptions}
            >
              <option value="">
                {loadingOptions ? 'Carregando...' : 'Selecione...'}
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-label-sm text-on-surface-variant uppercase mb-1.5">Quantidade *</label>
            <input
              type="number"
              min={1}
              className="w-full px-4 py-2.5 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </div>
        </div>

        <div>
          <label className="block text-label-sm text-on-surface-variant uppercase mb-1.5">
            Data do Empréstimo *
          </label>
          <input
            type="date"
            className="w-full px-4 py-2.5 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            value={loanDate}
            onChange={(e) => setLoanDate(e.target.value)}
          />
        </div>

        <div className="p-3 bg-surface-container rounded-lg border border-dashed border-outline text-[12px] text-on-surface-variant">
          Ao registrar este empréstimo, o histórico do cliente será atualizado automaticamente.
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-6 py-2.5 border border-outline-variant rounded-lg font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || loadingOptions}
            className="px-6 py-2.5 bg-primary text-on-primary rounded-lg font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-70"
          >
            {loading ? 'Registrando...' : 'Confirmar Empréstimo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
