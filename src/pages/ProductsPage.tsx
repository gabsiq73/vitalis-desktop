import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import { Modal } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import type {
  ProductResponseDTO,
  ProductRequestDTO,
  ProductUpdateDTO,
  ProductType,
  SpringPage,
} from '../types';
import { formatBRL } from '../utils/format';

const PAGE_SIZE = 20;

const PRODUCT_ICONS: Record<string, string> = {
  GAS: 'propane_tank',
  WATER: 'water_drop',
};

interface ProductFormProps {
  initial?: ProductResponseDTO;
  onSubmit: (data: ProductRequestDTO | ProductUpdateDTO) => Promise<void>;
  onClose: () => void;
}

function ProductForm({ initial, onSubmit, onClose }: ProductFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [basePrice, setBasePrice] = useState(initial?.basePrice?.toString() ?? '');
  const [lastCostPrice, setLastCostPrice] = useState(initial?.lastCostPrice?.toString() ?? '');
  const [type, setType] = useState<ProductType>(initial?.type ?? 'GAS');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Nome é obrigatório.'); return; }
    const price = parseFloat(basePrice);
    if (isNaN(price) || price <= 0) { setError('Preço base deve ser maior que zero.'); return; }
    setLoading(true);
    setError('');
    try {
      const cost = lastCostPrice ? parseFloat(lastCostPrice) : undefined;
      await onSubmit({ name: name.trim(), basePrice: price, lastCostPrice: cost, type });
    } catch {
      setError('Erro ao salvar produto. Verifique os dados.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">
      <div>
        <label className="block text-label-sm text-on-surface-variant uppercase mb-1.5">Nome *</label>
        <input
          className="w-full px-4 py-2.5 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
          placeholder="Ex: Botijão P13 - GLP"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
        />
      </div>

      <div>
        <label className="block text-label-sm text-on-surface-variant uppercase mb-1.5">Tipo *</label>
        <div className="flex gap-3">
          {(['GAS', 'WATER'] as ProductType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border font-bold text-sm transition-all ${
                type === t
                  ? 'bg-primary text-on-primary border-primary'
                  : 'border-outline-variant text-on-surface-variant hover:border-primary/40'
              }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                {PRODUCT_ICONS[t]}
              </span>
              {t === 'GAS' ? 'Gás GLP' : 'Água / Água Mineral'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-label-sm text-on-surface-variant uppercase mb-1.5">
            Preço de Venda (R$) *
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            className="w-full px-4 py-2.5 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            placeholder="0,00"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-label-sm text-on-surface-variant uppercase mb-1.5">
            Último Custo (R$)
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            className="w-full px-4 py-2.5 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            placeholder="0,00"
            value={lastCostPrice}
            onChange={(e) => setLastCostPrice(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex gap-3 justify-end pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="px-6 py-2.5 border border-outline-variant rounded-lg font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-primary text-on-primary rounded-lg font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-70"
        >
          {loading ? 'Salvando...' : initial ? 'Salvar Alterações' : 'Criar Produto'}
        </button>
      </div>
    </form>
  );
}

export function ProductsPage() {
  const { http } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductResponseDTO[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProductResponseDTO | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [toggleTarget, setToggleTarget] = useState<ProductResponseDTO | null>(null);

  function fetchProducts() {
    if (!http) return;
    setLoading(true);
    const params: Record<string, string | number> = { page: currentPage, size: PAGE_SIZE, sort: 'name' };
    http
      .get<SpringPage<ProductResponseDTO>>('/products', { params })
      .then((res) => {
        setProducts(res.data.content);
        setTotalElements(res.data.totalElements);
        setTotalPages(res.data.totalPages);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchProducts(); }, [http, currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = typeFilter
    ? products.filter((p) => p.type === typeFilter)
    : products;

  const activeCount = products.filter((p) => p.isActive).length;

  async function handleCreate(data: ProductRequestDTO | ProductUpdateDTO) {
    await http!.post('/products', data);
    setShowForm(false);
    fetchProducts();
  }

  async function handleEdit(data: ProductRequestDTO | ProductUpdateDTO) {
    await http!.put(`/products/${editing!.id}`, data);
    setEditing(undefined);
    setShowForm(false);
    fetchProducts();
  }

  async function handleDelete() {
    if (!http || !deleteTarget) return;
    await http.delete(`/products/${deleteTarget}`);
    fetchProducts();
  }

  async function handleToggleActive() {
    if (!http || !toggleTarget) return;
    await http.patch(`/products/${toggleTarget.id}/toggle-active`);
    fetchProducts();
  }

  function openEdit(p: ProductResponseDTO) {
    setEditing(p);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(undefined);
  }

  return (
    <>
      <TopBar />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2">
            <h1 className="text-h1 text-on-surface">Produtos</h1>
            <p className="text-body-lg text-on-surface-variant">
              Gerencie o catálogo completo de mercadorias e insumos.
            </p>
          </div>
          <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-start">
              <span className="text-label-sm text-on-surface-variant uppercase font-bold tracking-wider">
                Total de SKUs
              </span>
              <span className="material-symbols-outlined text-primary">inventory</span>
            </div>
            <p className="text-h2 text-on-surface mt-1">{loading ? '—' : totalElements}</p>
          </div>
          <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-start">
              <span className="text-label-sm text-on-surface-variant uppercase font-bold tracking-wider">
                Produtos Ativos
              </span>
              <span className="material-symbols-outlined text-tertiary">check_circle</span>
            </div>
            <p className="text-h2 text-on-surface mt-1">
              {loading
                ? '—'
                : products.length === 0
                ? '—'
                : `${Math.round((activeCount / products.length) * 100)}%`}
            </p>
          </div>
        </div>

        <section className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {[
                { value: '', label: 'Todos' },
                { value: 'GAS', label: 'Gás GLP' },
                { value: 'WATER', label: 'Água' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTypeFilter(opt.value)}
                  className={`px-4 py-1.5 rounded-full text-label-sm font-bold transition-colors ${
                    typeFilter === opt.value
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setEditing(undefined); setShowForm(true); }}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold shadow-md shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
              Novo Produto
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-high border-b border-outline-variant">
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">Nome</th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">Tipo</th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">Preço Base</th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">Último Custo</th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">Status</th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">
                      Carregando...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-surface-container transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-surface-container-highest rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>
                              {PRODUCT_ICONS[p.type] ?? 'inventory'}
                            </span>
                          </div>
                          <div>
                            <p className="font-bold text-on-surface">{p.name}</p>
                            <p className="text-[10px] text-on-surface-variant font-mono">
                              {p.id.slice(-8).toUpperCase()}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-on-surface-variant text-body-md">
                        {p.type === 'GAS' ? 'Gás GLP' : 'Água'}
                      </td>
                      <td className="px-6 py-4 font-bold text-on-surface">
                        {formatBRL(p.basePrice)}
                      </td>
                      <td className="px-6 py-4 text-on-surface-variant">
                        {p.lastCostPrice ? formatBRL(p.lastCostPrice) : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-label-sm font-bold inline-flex items-center gap-1.5 ${
                            p.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${p.isActive ? 'bg-green-500' : 'bg-outline'}`}
                          />
                          {p.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(p)}
                            className="p-2 text-primary hover:bg-primary/10 rounded-lg"
                            title="Editar"
                          >
                            <span className="material-symbols-outlined">edit</span>
                          </button>
                          <button
                            onClick={() => setToggleTarget(p)}
                            className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg"
                            title={p.isActive ? 'Desativar' : 'Ativar'}
                          >
                            <span className="material-symbols-outlined">
                              {p.isActive ? 'block' : 'check_circle'}
                            </span>
                          </button>
                          <button
                            onClick={() => setDeleteTarget(p.id)}
                            className="p-2 text-error hover:bg-error/10 rounded-lg"
                            title="Excluir"
                          >
                            <span className="material-symbols-outlined">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
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

      <Modal
        open={showForm}
        onClose={closeForm}
        title={editing ? 'Editar Produto' : 'Novo Produto'}
        maxWidth="max-w-lg"
      >
        <ProductForm
          initial={editing}
          onSubmit={editing ? handleEdit : handleCreate}
          onClose={closeForm}
        />
      </Modal>

      <ConfirmModal
        open={toggleTarget !== null}
        title={toggleTarget?.isActive ? 'Desativar Produto' : 'Ativar Produto'}
        message={
          toggleTarget?.isActive
            ? `Desativar "${toggleTarget?.name}"? Ele não aparecerá em novos pedidos.`
            : `Ativar "${toggleTarget?.name}"?`
        }
        confirmLabel={toggleTarget?.isActive ? 'Desativar' : 'Ativar'}
        danger={toggleTarget?.isActive}
        onConfirm={handleToggleActive}
        onClose={() => setToggleTarget(null)}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        title="Excluir Produto"
        message="Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        danger
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
