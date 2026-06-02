import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import { Modal } from '../components/Modal';
import type { StockResponseDTO, SpringPage } from '../types';

const PAGE_SIZE = 20;

function getStockStatusBadge(status: string): { label: string; className: string; dot: string } {
  const s = status.toUpperCase();
  if (s === 'LOW' || s === 'LOW_STOCK') {
    return { label: 'BAIXO', className: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500 animate-pulse' };
  }
  if (s === 'OUT_OF_STOCK' || s === 'CRITICAL') {
    return { label: 'SEM ESTOQUE', className: 'bg-red-100 text-red-700', dot: 'bg-red-600' };
  }
  return { label: 'NORMAL', className: 'bg-green-100 text-green-700', dot: 'bg-green-500' };
}

interface AdjustModalProps {
  item: StockResponseDTO;
  onConfirm: (productId: string, quantity: number) => Promise<void>;
  onClose: () => void;
}

function AdjustModal({ item, onConfirm, onClose }: AdjustModalProps) {
  const [quantity, setQuantity] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    if (quantity === 0) { setError('Informe um valor diferente de zero.'); return; }
    setLoading(true);
    setError('');
    try {
      await onConfirm(item.productId, quantity);
      onClose();
    } catch {
      setError('Erro ao ajustar estoque. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="p-4 bg-surface-container rounded-lg">
        <p className="text-label-sm text-on-surface-variant uppercase mb-1">Produto Selecionado</p>
        <p className="font-bold text-on-surface text-body-lg">{item.productName}</p>
        <p className="text-primary mt-1 text-sm">
          Estoque atual:{' '}
          <span className="font-bold">{item.quantityInStock.toLocaleString('pt-BR')}</span> unidades
        </p>
      </div>

      <div>
        <label className="block text-label-sm text-on-surface-variant uppercase mb-1.5">
          Quantidade do Ajuste
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setQuantity((q) => q - 1)}
            className="w-10 h-10 rounded-full bg-error/10 text-error flex items-center justify-center hover:bg-error/20 transition-colors font-bold text-lg"
          >
            −
          </button>
          <input
            type="number"
            className="flex-1 text-center px-4 py-2.5 border border-outline-variant rounded-lg text-body-lg font-bold bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
          <button
            type="button"
            onClick={() => setQuantity((q) => q + 1)}
            className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors font-bold text-lg"
          >
            +
          </button>
        </div>
        <p className="text-[11px] text-on-surface-variant mt-1.5">
          Valores positivos para entradas, negativos para saídas.
        </p>
      </div>

      {quantity !== 0 && (
        <div className={`p-3 rounded-lg text-sm font-semibold ${quantity > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          Novo estoque previsto:{' '}
          <span className="font-black">
            {(item.quantityInStock + quantity).toLocaleString('pt-BR')} unidades
          </span>
        </div>
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex gap-3 justify-end pt-2">
        <button
          onClick={onClose}
          disabled={loading}
          className="px-6 py-2.5 border border-outline-variant rounded-lg font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="px-6 py-2.5 bg-primary text-on-primary rounded-lg font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-70"
        >
          {loading ? 'Salvando...' : 'Confirmar Ajuste'}
        </button>
      </div>
    </div>
  );
}

export function StockPage() {
  const { http } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<StockResponseDTO[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [adjustTarget, setAdjustTarget] = useState<StockResponseDTO | null>(null);

  function fetchStock() {
    if (!http) return;
    setLoading(true);
    http
      .get<SpringPage<StockResponseDTO>>('/stocks', { params: { page: currentPage, size: PAGE_SIZE } })
      .then((res) => {
        setItems(res.data.content);
        setTotalElements(res.data.totalElements);
        setTotalPages(res.data.totalPages);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchStock(); }, [http, currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdjust(productId: string, quantity: number) {
    await http!.patch(`/stocks/products/${productId}`, quantity, {
      headers: { 'Content-Type': 'application/json' },
    });
    setAdjustTarget(null);
    fetchStock();
  }

  const lowCount = items.filter((i) => {
    const s = i.status.toUpperCase();
    return s === 'LOW' || s === 'LOW_STOCK' || s === 'OUT_OF_STOCK' || s === 'CRITICAL';
  }).length;

  const waterTotal = items.filter((i) => i.productName.toUpperCase().includes('WATER') || i.productName.toUpperCase().includes('GALÃO') || i.productName.toUpperCase().includes('ÁGUA')).reduce((sum, i) => sum + i.quantityInStock, 0);

  const gasTotal = items.filter((i) => !i.productName.toUpperCase().includes('GALÃO') && !i.productName.toUpperCase().includes('ÁGUA')).reduce((sum, i) => sum + i.quantityInStock, 0);

  return (
    <>
      <TopBar />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-h1 text-on-surface">Gestão de Estoque</h1>
            <p className="text-body-lg text-on-surface-variant">
              Monitoramento em tempo real de suprimentos e ativos.
            </p>
          </div>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">inventory</span>
              <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Total</span>
            </div>
            <p className="text-sm font-medium text-on-surface-variant">Total Itens</p>
            <p className="text-h2 text-on-surface">
              {loading ? '—' : totalElements.toLocaleString('pt-BR')}
            </p>
          </div>

          <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="material-symbols-outlined text-error bg-error/10 p-2 rounded-lg">warning</span>
              {lowCount > 0 && (
                <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                  {lowCount} crítico{lowCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-on-surface-variant">Estoque Baixo</p>
            <p className="text-h2 text-on-surface">{loading ? '—' : lowCount}</p>
          </div>

          <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="material-symbols-outlined text-secondary bg-secondary-container/50 p-2 rounded-lg">
                water_drop
              </span>
            </div>
            <p className="text-sm font-medium text-on-surface-variant">Água Mineral</p>
            <p className="text-h2 text-on-surface">
              {loading ? '—' : waterTotal.toLocaleString('pt-BR')}
            </p>
          </div>

          <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="material-symbols-outlined text-tertiary bg-tertiary-fixed/50 p-2 rounded-lg">
                local_fire_department
              </span>
            </div>
            <p className="text-sm font-medium text-on-surface-variant">Gás GLP</p>
            <p className="text-h2 text-on-surface">
              {loading ? '—' : gasTotal.toLocaleString('pt-BR')}
            </p>
          </div>
        </section>

        <section className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low flex items-center justify-between">
            <h3 className="text-h3 text-on-surface">Listagem de Produtos</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">Produto</th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">Qtd. Atual</th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">Qtd. Mínima</th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">Status</th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-on-surface-variant text-body-md">
                      Carregando...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-on-surface-variant text-body-md">
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const badge = getStockStatusBadge(item.status);
                    const isLow = item.quantityInStock < item.minimumStock;
                    return (
                      <tr key={item.productId} className="hover:bg-surface-container transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center flex-shrink-0">
                              <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>
                                propane_tank
                              </span>
                            </div>
                            <div>
                              <p className="font-bold text-on-surface">{item.productName}</p>
                              <p className="text-[10px] text-on-surface-variant font-mono">
                                {item.productId.slice(-8).toUpperCase()}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`font-bold text-body-md ${isLow ? 'text-error' : 'text-on-surface'}`}>
                            {item.quantityInStock.toLocaleString('pt-BR')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-body-md text-on-surface-variant">
                          {item.minimumStock.toLocaleString('pt-BR')}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1.5 ${badge.className}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setAdjustTarget(item)}
                            className="px-4 py-1.5 border border-outline text-on-surface-variant rounded-lg text-sm font-semibold hover:bg-primary hover:text-white hover:border-primary transition-all"
                          >
                            Ajustar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-low flex items-center justify-between">
              <p className="text-sm text-on-surface-variant">
                Mostrando{' '}
                <span className="font-bold text-on-surface">
                  {Math.min(currentPage * PAGE_SIZE + 1, totalElements)}–
                  {Math.min((currentPage + 1) * PAGE_SIZE, totalElements)}
                </span>{' '}
                de <span className="font-bold text-on-surface">{totalElements}</span> produtos
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container disabled:opacity-30 transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
                  Anterior
                </button>
                <span className="text-sm text-on-surface-variant px-2">
                  Página {currentPage + 1} de {totalPages}
                </span>
                <button
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container disabled:opacity-30 transition-colors"
                >
                  Próxima
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {adjustTarget && (
        <Modal
          open={adjustTarget !== null}
          onClose={() => setAdjustTarget(null)}
          title="Ajustar Estoque"
          maxWidth="max-w-md"
        >
          <AdjustModal
            item={adjustTarget}
            onConfirm={handleAdjust}
            onClose={() => setAdjustTarget(null)}
          />
        </Modal>
      )}
    </>
  );
}
