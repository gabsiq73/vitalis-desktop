import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../contexts/NotificationContext';
import { parseApiError } from '../utils/parseApiError';
import { TopBar } from '../components/TopBar';
import { Modal } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import type {
  ProductResponseDTO,
  ProductRequestDTO,
  ProductUpdateDTO,
  ProductType,
  SpringPage,
  GasSupplierResponseDTO,
} from '../types';
import { formatBRL } from '../utils/format';
import { SortableHeader } from '../components/SortableHeader';
import type { SortState } from '../components/SortableHeader';
import { PageSizeSelector } from '../components/PageSizeSelector';


const TYPE_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  GAS:   { icon: 'propane_tank', label: 'Gás GLP',  color: 'text-orange-600', bg: 'bg-orange-50' },
  WATER: { icon: 'water_drop',  label: 'Água',       color: 'text-blue-600',   bg: 'bg-blue-50' },
};

interface ProductFormProps {
  initial?: ProductResponseDTO;
  onSubmit: (data: ProductRequestDTO | ProductUpdateDTO) => Promise<void>;
  onClose: () => void;
}

function ProductForm({ initial, onSubmit, onClose }: ProductFormProps) {
  const { http } = useAuth();
  const [name, setName] = useState(initial?.name ?? '');
  const [basePrice, setBasePrice] = useState(initial?.basePrice?.toString() ?? '');
  const [resellerPrice, setResellerPrice] = useState(initial?.resellerPrice?.toString() ?? '');
  const [lastCostPrice, setLastCostPrice] = useState(initial?.lastCostPrice?.toString() ?? '');
  const [type, setType] = useState<ProductType>(initial?.type ?? 'GAS');
  const [defaultSupplierId, setDefaultSupplierId] = useState(initial?.defaultSupplierId ?? '');
  const [suppliers, setSuppliers] = useState<GasSupplierResponseDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (http) {
      http.get<SpringPage<GasSupplierResponseDTO>>('/suppliers', { params: { size: 100 } })
        .then(res => setSuppliers(res.data.content))
        .catch(() => setSuppliers([]));
    }
  }, [http]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Nome é obrigatório.'); return; }
    const price = parseFloat(basePrice);
    if (isNaN(price) || price <= 0) { setError('Preço de venda deve ser maior que zero.'); return; }
    const cost = lastCostPrice ? parseFloat(lastCostPrice) : undefined;
    if (type === 'GAS') {
      if (!cost || isNaN(cost) || cost <= 0) { setError('Preço de custo obrigatório para Gás GLP.'); return; }
      if (!defaultSupplierId) { setError('Distribuidor padrão obrigatório para Gás GLP.'); return; }
    }
    setLoading(true);
    setError('');
    const reseller = resellerPrice ? parseFloat(resellerPrice) : undefined;
    if (reseller !== undefined && (isNaN(reseller) || reseller <= 0)) {
      setError('Preço de revenda deve ser maior que zero se informado.'); setLoading(false); return;
    }
    if (reseller !== undefined && price > 0 && reseller >= price) {
      setError('Preço de revenda deve ser menor que o preço de venda.'); setLoading(false); return;
    }
    try {
      await onSubmit({
        name: name.trim(),
        basePrice: price,
        resellerPrice: reseller,
        lastCostPrice: cost,
        type,
        defaultSupplierId: type === 'GAS' ? defaultSupplierId : undefined,
      });
    } catch (err: unknown) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Nome *</label>
        <input className={inputCls} placeholder="Ex: Botijão P13" value={name} onChange={e => setName(e.target.value)} maxLength={100} />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Tipo *</label>
        <div className="flex gap-2">
          {(['GAS', 'WATER'] as ProductType[]).map(t => {
            const cfg = TYPE_CONFIG[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => { setType(t); if (t === 'WATER') setDefaultSupplierId(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                  type === t ? 'bg-primary text-white border-primary' : 'border-slate-200 text-slate-600 hover:border-primary/40 hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{cfg.icon}</span>
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Preço de Venda *</label>
          <input type="number" step="0.01" min="0.01" className={inputCls} placeholder="0,00" value={basePrice} onChange={e => setBasePrice(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Último Custo {type === 'GAS' && '*'}</label>
          <input type="number" step="0.01" min="0.01" className={inputCls} placeholder="0,00" value={lastCostPrice} onChange={e => setLastCostPrice(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">
          Preço de Revenda
          <span className="ml-1 normal-case font-normal text-slate-400">(opcional — aplicado automaticamente para clientes Revendedor)</span>
        </label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          className={inputCls}
          placeholder={basePrice ? `Deve ser menor que R$ ${parseFloat(basePrice).toFixed(2)}` : '0,00'}
          value={resellerPrice}
          onChange={e => setResellerPrice(e.target.value)}
        />
      </div>

      {type === 'GAS' && (
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Distribuidor Padrão *</label>
          <select className={inputCls} value={defaultSupplierId} onChange={e => setDefaultSupplierId(e.target.value)}>
            <option value="">Selecione um distribuidor...</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      <div className="flex gap-3 justify-end pt-1">
        <button type="button" onClick={onClose} disabled={loading} className="px-5 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
          Cancelar
        </button>
        <button type="submit" disabled={loading} className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:brightness-110 active:scale-95 transition-all disabled:opacity-70">
          {loading ? 'Salvando...' : initial ? 'Salvar Alterações' : 'Criar Produto'}
        </button>
      </div>
    </form>
  );
}

export function ProductsPage() {
  const { http } = useAuth();
  const { notify } = useNotification();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductResponseDTO[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [sort, setSort] = useState<SortState | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(15);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProductResponseDTO | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<ProductResponseDTO | null>(null);
  const [toggleTarget, setToggleTarget] = useState<ProductResponseDTO | null>(null);

  const fetchProducts = useCallback(() => {
    if (!http) return;
    setLoading(true);
    const params: Record<string, string | number> = { page: currentPage, size: pageSize, sort: sort ? `${sort.field},${sort.dir}` : 'name,asc' };
    http.get<SpringPage<ProductResponseDTO>>('/products', { params })
      .then(res => {
        setProducts(res.data.content);
        setTotalElements(res.data.totalElements);
        setTotalPages(res.data.totalPages);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [http, currentPage, sort, pageSize]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const filtered = products
    .filter(p => !typeFilter || p.type === typeFilter)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  async function handleCreate(data: ProductRequestDTO | ProductUpdateDTO) {
    await http!.post('/products', data);
    setShowForm(false);
    notify('Produto criado com sucesso.', 'success');
    fetchProducts();
  }

  async function handleEdit(data: ProductRequestDTO | ProductUpdateDTO) {
    await http!.put(`/products/${editing!.id}`, data);
    setEditing(undefined);
    setShowForm(false);
    notify('Produto atualizado com sucesso.', 'success');
    fetchProducts();
  }

  async function handleDelete() {
    if (!http || !deleteTarget) return;
    await http.delete(`/products/${deleteTarget.id}`);
    notify(`Produto "${deleteTarget.name}" excluído.`, 'info');
    setDeleteTarget(null);
    fetchProducts();
  }

  async function handleToggleActive() {
    if (!http || !toggleTarget) return;
    await http.patch(`/products/${toggleTarget.id}/toggle-active`);
    notify(`Produto "${toggleTarget.name}" ${toggleTarget.isActive ? 'desativado' : 'ativado'}.`, toggleTarget.isActive ? 'warning' : 'success');
    setToggleTarget(null);
    fetchProducts();
  }

  function openEdit(p: ProductResponseDTO) { setEditing(p); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(undefined); }

  const gasCount = products.filter(p => p.type === 'GAS').length;
  const waterCount = products.filter(p => p.type === 'WATER').length;
  const activeCount = products.filter(p => p.isActive).length;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar title="Produtos" subtitle="Gerencie o catálogo de produtos" />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total de SKUs',    value: loading ? '—' : String(totalElements), icon: 'inventory',     topColor: '#0056c6' },
            { label: 'Produtos Ativos',  value: loading ? '—' : String(activeCount),   icon: 'check_circle',  topColor: '#0d9488' },
            { label: 'Gás GLP',          value: loading ? '—' : String(gasCount),      icon: 'propane_tank',  topColor: '#f97316' },
            { label: 'Água',             value: loading ? '—' : String(waterCount),    icon: 'water_drop',    topColor: '#3b82f6' },
          ].map(k => (
            <div key={k.label} className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: k.topColor }} />
              <div className="p-5 pt-6 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-1">{k.label}</p>
                  <p className="text-2xl font-bold text-slate-800">{k.value}</p>
                </div>
                <span className="material-symbols-outlined text-slate-300" style={{ fontSize: '28px' }}>{k.icon}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Table card */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">

          {/* Toolbar */}
          <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center gap-3">
            {/* Type filter chips */}
            <div className="flex gap-1.5">
              {[
                { value: '',      label: 'Todos' },
                { value: 'GAS',   label: 'Gás GLP' },
                { value: 'WATER', label: 'Água' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTypeFilter(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                    typeFilter === opt.value
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex-1 max-w-xs relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: '16px' }}>search</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar produto..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div className="ml-auto flex items-center gap-4">
              <PageSizeSelector value={pageSize} onChange={(s) => { setPageSize(s); setCurrentPage(0); }} />
              <button
                onClick={() => { setEditing(undefined); setShowForm(true); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-semibold shadow-sm shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>add</span>
                Novo Produto
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider"><SortableHeader label="Produto" field="name" sort={sort} onSort={setSort} defaultDir="asc" /></th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider"><SortableHeader label="Tipo" field="type" sort={sort} onSort={setSort} defaultDir="asc" /></th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider"><SortableHeader label="Preço Venda" field="basePrice" sort={sort} onSort={setSort} defaultDir="desc" /></th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-violet-500 uppercase tracking-wider">Preço Revenda</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Último Custo</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Distribuidor Padrão</th>
                  <th className="text-center px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-[13px] text-slate-400">Carregando...</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center">
                      <span className="material-symbols-outlined block mb-2 text-slate-200" style={{ fontSize: '40px' }}>inventory_2</span>
                      <p className="text-[13px] text-slate-400">Nenhum produto encontrado.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map(p => {
                    const cfg = TYPE_CONFIG[p.type] ?? TYPE_CONFIG['WATER'];
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors group">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                              <span className={`material-symbols-outlined ${cfg.color}`} style={{ fontSize: '18px' }}>{cfg.icon}</span>
                            </div>
                            <div>
                              <p className="text-[13px] font-semibold text-slate-800">{p.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{p.id.slice(-8).toUpperCase()}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>{cfg.icon}</span>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-slate-800">{formatBRL(p.basePrice)}</td>
                        <td className="px-4 py-3.5 text-right">
                          {p.resellerPrice
                            ? <span className="font-semibold text-violet-700">{formatBRL(p.resellerPrice)}</span>
                            : <span className="text-slate-300 text-[12px]">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-right text-slate-500">{p.lastCostPrice ? formatBRL(p.lastCostPrice) : '—'}</td>
                        <td className="px-4 py-3.5 text-slate-600 text-[13px]">
                          {p.type === 'GAS' ? (p.defaultSupplierName ?? <span className="text-slate-400">Não definido</span>) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            p.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${p.isActive ? 'bg-green-500' : 'bg-slate-400'}`} />
                            {p.isActive ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-0.5">
                            <button onClick={() => openEdit(p)} title="Editar" className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/8 transition-all">
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                            </button>
                            <button onClick={() => setToggleTarget(p)} title={p.isActive ? 'Desativar' : 'Ativar'} className={`p-1.5 rounded-lg transition-all ${p.isActive ? 'text-slate-400 hover:text-amber-500 hover:bg-amber-50' : 'text-slate-400 hover:text-green-600 hover:bg-green-50'}`}>
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{p.isActive ? 'block' : 'check_circle'}</span>
                            </button>
                            <button onClick={() => setDeleteTarget(p)} title="Excluir" className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all">
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <span className="text-[12px] text-slate-500">
                {Math.min(currentPage * pageSize + 1, totalElements)}–{Math.min((currentPage + 1) * pageSize, totalElements)}
                {' '}<span className="text-slate-400">de</span>{' '}
                <span className="font-semibold text-slate-700">{totalElements}</span> produtos
              </span>
              <div className="flex items-center gap-1">
                <button disabled={currentPage === 0} onClick={() => setCurrentPage(p => p - 1)} className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const start = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
                  return start + i;
                }).map(pageNum => (
                  <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`w-8 h-8 rounded-lg text-[13px] font-semibold transition-colors ${pageNum === currentPage ? 'bg-primary text-white' : 'text-slate-500 hover:bg-white border border-transparent hover:border-slate-200'}`}>
                    {pageNum + 1}
                  </button>
                ))}
                <button disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage(p => p + 1)} className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <Modal open={showForm} onClose={closeForm} title={editing ? 'Editar Produto' : 'Novo Produto'} maxWidth="max-w-lg">
        <ProductForm initial={editing} onSubmit={editing ? handleEdit : handleCreate} onClose={closeForm} />
      </Modal>

      <ConfirmModal
        open={toggleTarget !== null}
        title={toggleTarget?.isActive ? 'Desativar Produto' : 'Ativar Produto'}
        message={toggleTarget?.isActive ? `Desativar "${toggleTarget?.name}"? Ele não aparecerá em novos pedidos.` : `Ativar "${toggleTarget?.name}"?`}
        confirmLabel={toggleTarget?.isActive ? 'Desativar' : 'Ativar'}
        danger={toggleTarget?.isActive}
        onConfirm={handleToggleActive}
        onClose={() => setToggleTarget(null)}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        title="Excluir Produto"
        message={`Excluir "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        danger
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
