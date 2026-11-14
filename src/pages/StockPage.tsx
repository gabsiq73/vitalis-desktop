import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import { Modal } from '../components/Modal';
import { SortableHeader } from '../components/SortableHeader';
import type { SortState } from '../components/SortableHeader';
import { applySortInMemory } from '../utils/sort';
import { PageSizeSelector } from '../components/PageSizeSelector';
import { useScrollToError } from '../hooks/useScrollToError';
import { getStockStatus, isStockLow } from '../utils/stock';
import type { StockResponseDTO, ProductResponseDTO, SpringPage } from '../types';
import type { BottleInventoryResponseDTO } from '../types';
import { parseApiError } from '../utils/parseApiError';

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
  const [quantity, setQuantity] = useState('0');
  const adjustment = Number(quantity);
  const validAdjustment = quantity.trim() !== '' && Number.isInteger(adjustment) && adjustment !== 0;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useScrollToError<HTMLParagraphElement>(error);

  async function handleConfirm() {
    if (!validAdjustment) { setError('Informe uma quantidade inteira diferente de zero.'); return; }
    setLoading(true);
    setError('');
    try {
      await onConfirm(item.productId, adjustment);
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
        <label htmlFor="stock-adjustment" className="block text-label-sm text-on-surface-variant uppercase mb-1.5">
          Quantidade do Ajuste
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setQuantity((q) => String(Number(q) - 1))}
            className="w-10 h-10 rounded-full bg-error/10 text-error flex items-center justify-center hover:bg-error/20 transition-colors font-bold text-lg"
          >
            −
          </button>
          <input
            id="stock-adjustment"
            type="number"
            step={1}
            className="flex-1 text-center px-4 py-2.5 border border-outline-variant rounded-lg text-body-lg font-bold bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setQuantity((q) => String(Number(q) + 1))}
            className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors font-bold text-lg"
          >
            +
          </button>
        </div>
        <p className="text-[11px] text-on-surface-variant mt-1.5">
          Valores positivos para entradas, negativos para saídas.
        </p>
      </div>

      {validAdjustment && (
        <div className={`p-3 rounded-lg text-sm font-semibold ${adjustment > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          Novo estoque previsto:{' '}
          <span className="font-black">
            {(item.quantityInStock + adjustment).toLocaleString('pt-BR')} unidades
          </span>
        </div>
      )}

      {error && <p ref={errorRef} className="text-sm text-error">{error}</p>}

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
  const [gasProductIds, setGasProductIds] = useState<Set<string>>(new Set());
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const [adjustTarget, setAdjustTarget] = useState<StockResponseDTO | null>(null);
  const [inventory, setInventory] = useState<BottleInventoryResponseDTO | null>(null);
  const [inventoryError, setInventoryError] = useState('');
  const [showInventory, setShowInventory] = useState(false);
  const [validCount, setValidCount] = useState('0'); const [expiredCount, setExpiredCount] = useState('0');
  const [savingInventory, setSavingInventory] = useState(false);

  async function saveInventory(e: React.FormEvent) {
    e.preventDefault(); if (!http || savingInventory) return;
    setSavingInventory(true); setInventoryError('');
    try { const r = await http.put<BottleInventoryResponseDTO>('/bottle-inventory', { validQuantity: Number(validCount), expiredQuantity: Number(expiredCount) }); setInventory(r.data); setShowInventory(false); }
    catch (err) { setInventoryError(parseApiError(err)); } finally { setSavingInventory(false); }
  }

  async function fetchStock() {
    if (!http) return;
    setLoading(true);
    try {
      const [stockRes, productsRes, inventoryRes] = await Promise.allSettled([
        http.get<SpringPage<StockResponseDTO>>('/stocks', { params: { page: currentPage, size: pageSize } }),
        http.get<SpringPage<ProductResponseDTO>>('/products', { params: { size: 200, page: 0 } }),
        http.get<BottleInventoryResponseDTO>('/bottle-inventory'),
      ]);
      if (inventoryRes.status === 'fulfilled') { setInventory(inventoryRes.value.data); setInventoryError(''); }
      else { setInventory(null); setInventoryError(parseApiError(inventoryRes.reason)); }
      if (productsRes.status === 'fulfilled') {
        const gasIds = new Set(
          (productsRes.value.data.content ?? [])
            .filter(p => p.type === 'GAS')
            .map(p => p.id)
        );
        setGasProductIds(gasIds);
      }
      if (stockRes.status === 'fulfilled') {
        setItems(stockRes.value.data.content ?? []);
        setTotalPages(stockRes.value.data.totalPages);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchStock(); }, [http, currentPage, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdjust(productId: string, quantity: number) {
    await http!.patch(`/stocks/products/${productId}`, quantity, {
      headers: { 'Content-Type': 'application/json' },
    });
    setAdjustTarget(null);
    fetchStock();
  }

  const [sort, setSort] = useState<SortState | null>(null);
  const waterItems = applySortInMemory(items.filter(i => !gasProductIds.has(i.productId)), sort);

  const lowCount = waterItems.filter(isStockLow).length;

  const waterTotal = waterItems.reduce((sum, i) => sum + i.quantityInStock, 0);

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

        <section className="p-5 bg-white border border-slate-200 rounded-xl space-y-3">
          <div className="flex flex-wrap gap-3 items-center justify-between"><h2 className="font-bold text-slate-800">Garrafões do depósito</h2><button onClick={() => { setValidCount(String(inventory?.validQuantity ?? 0)); setExpiredCount(String(inventory?.expiredQuantity ?? 0)); setShowInventory(true); }} className="text-primary font-semibold text-sm">Informar / corrigir totais</button></div>
          {inventoryError && !showInventory && <p role="alert" className="text-sm text-red-700">{inventoryError}</p>}
          {inventory?.configured ? <div className="grid grid-cols-2 md:grid-cols-5 gap-3">{[
            ['Total de garrafões', inventory.totalQuantity], ['Válidos (vazios + cheios)', inventory.validQuantity], ['Vencidos', inventory.expiredQuantity], ['Águas cheias', inventory.filledQuantity], ['Válidos vazios', inventory.emptyValidQuantity],
          ].map(([label,count]) => <div key={label} className="p-3 bg-slate-50 rounded-lg"><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-bold">{count}</p></div>)}</div> : <p className="text-sm text-amber-800">Informe a contagem física de garrafões válidos e vencidos para ativar o controle total. Os estoques existentes de água serão preservados.</p>}
          <p className="text-xs text-slate-500">As águas cheias usam os garrafões válidos. Para realocar entre águas, reduza uma e aumente outra. A troca comum mantém o total; completo e vencido vendidos saem do total correspondente.</p>
        </section>
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">inventory</span>
              <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Total</span>
            </div>
            <p className="text-sm font-medium text-on-surface-variant">Total Itens</p>
            <p className="text-h2 text-on-surface">
              {loading ? '—' : waterItems.length.toLocaleString('pt-BR')}
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
            <p className="text-h2 text-on-surface text-label-lg font-bold text-on-surface-variant">
              Sem controle
            </p>
          </div>
        </section>

        <section className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low flex items-center justify-between">
            <h3 className="text-h3 text-on-surface">Listagem de Produtos</h3>
            <PageSizeSelector value={pageSize} onChange={(s) => { setPageSize(s); setCurrentPage(0); }} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase"><SortableHeader label="Produto" field="productName" sort={sort} onSort={setSort} defaultDir="asc" /></th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase"><SortableHeader label="Qtd. Atual" field="quantityInStock" sort={sort} onSort={setSort} defaultDir="desc" /></th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase"><SortableHeader label="Qtd. Mínima" field="minimumStock" sort={sort} onSort={setSort} defaultDir="desc" /></th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase"><SortableHeader label="Status" field="status" sort={sort} onSort={setSort} defaultDir="asc" /></th>
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
                ) : waterItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-on-surface-variant text-body-md">
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                ) : (
                  waterItems.map((item) => {
                    const badge = getStockStatusBadge(getStockStatus(item));
                    const isLow = isStockLow(item);
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
                  {Math.min(currentPage * pageSize + 1, waterItems.length)}–
                  {Math.min((currentPage + 1) * pageSize, waterItems.length)}
                </span>{' '}
                de <span className="font-bold text-on-surface">{waterItems.length}</span> produtos
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

      {showInventory && <Modal open title="Totais de garrafões" maxWidth="max-w-lg" onClose={() => { if (!savingInventory) setShowInventory(false); }}><form onSubmit={saveInventory} className="p-6 space-y-4">
        <p className="text-sm text-slate-600">Conte todos os garrafões físicos: vazios e cheios. Válidos precisam cobrir as {inventory?.filledQuantity ?? 0} águas cheias já registradas.</p>
        {inventoryError && <p role="alert" className="text-sm text-red-700">{inventoryError}</p>}
        <label className="block text-sm">Garrafões válidos<input required disabled={savingInventory} type="number" min="0" step="1" value={validCount} onChange={e => setValidCount(e.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2" /></label>
        <label className="block text-sm">Garrafões vencidos<input required disabled={savingInventory} type="number" min="0" step="1" value={expiredCount} onChange={e => setExpiredCount(e.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2" /></label>
        <button disabled={savingInventory} className="px-4 py-2 bg-primary text-white rounded-lg">{savingInventory ? 'Salvando...' : 'Salvar totais'}</button>
      </form></Modal>}
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
