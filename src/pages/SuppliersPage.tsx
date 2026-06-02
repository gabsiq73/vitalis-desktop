import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import { Modal } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import type { GasSupplierResponseDTO, GasSupplierRequestDTO, SpringPage } from '../types';
import { getInitials } from '../utils/format';

const PAGE_SIZE = 20;

const AVATAR_COLORS = [
  'bg-primary/10 text-primary',
  'bg-tertiary/10 text-tertiary',
  'bg-secondary-container text-on-secondary-container',
  'bg-primary-fixed text-on-primary-fixed-variant',
];

function getAvatarColor(id: string): string {
  const index = id.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

interface SupplierFormProps {
  initial?: GasSupplierResponseDTO;
  onSubmit: (data: GasSupplierRequestDTO) => Promise<void>;
  onClose: () => void;
}

function SupplierForm({ initial, onSubmit, onClose }: SupplierFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Nome é obrigatório.'); return; }
    setLoading(true);
    setError('');
    try {
      await onSubmit({ name: name.trim(), notes: notes.trim() || undefined });
    } catch {
      setError('Erro ao salvar fornecedor.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">
      <div>
        <label className="block text-label-sm text-on-surface-variant uppercase mb-1.5">
          Nome do Fornecedor *
        </label>
        <input
          className="w-full px-4 py-2.5 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
          placeholder="Ex: PetroGás Distribuidora"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
        />
      </div>
      <div>
        <label className="block text-label-sm text-on-surface-variant uppercase mb-1.5">
          Observações
        </label>
        <textarea
          className="w-full px-4 py-2.5 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
          placeholder="Informações logísticas, prazos, contatos..."
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
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
          {loading ? 'Salvando...' : initial ? 'Salvar Alterações' : 'Criar Fornecedor'}
        </button>
      </div>
    </form>
  );
}

export function SuppliersPage() {
  const { http } = useAuth();
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<GasSupplierResponseDTO[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<GasSupplierResponseDTO | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  function fetchSuppliers() {
    if (!http) return;
    setLoading(true);
    const params: Record<string, string | number> = { page: currentPage, size: PAGE_SIZE };
    http
      .get<SpringPage<GasSupplierResponseDTO>>('/suppliers', { params })
      .then((res) => {
        setSuppliers(res.data.content);
        setTotalElements(res.data.totalElements);
        setTotalPages(res.data.totalPages);
      })
      .catch(() => setSuppliers([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchSuppliers(); }, [http, currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = searchQuery.trim()
    ? suppliers.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : suppliers;

  async function handleCreate(data: GasSupplierRequestDTO) {
    await http!.post('/suppliers', data);
    setShowForm(false);
    fetchSuppliers();
  }

  async function handleEdit(data: GasSupplierRequestDTO) {
    await http!.put(`/suppliers/${editing!.id}`, data);
    setEditing(undefined);
    setShowForm(false);
    fetchSuppliers();
  }

  async function handleDelete() {
    if (!http || !deleteTarget) return;
    await http.delete(`/suppliers/${deleteTarget}`);
    fetchSuppliers();
  }

  function openEdit(s: GasSupplierResponseDTO) {
    setEditing(s);
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
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-h1 text-on-surface">Fornecedores de Gás</h1>
            <p className="text-body-lg text-on-surface-variant">
              Gerencie sua rede de fornecedores e parceiros logísticos.
            </p>
          </div>
          <button
            onClick={() => { setEditing(undefined); setShowForm(true); }}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold shadow-md shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            Novo Fornecedor
          </button>
        </div>

        <section className="bg-surface border border-outline-variant rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">
              search
            </span>
            <input
              className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
              placeholder="Buscar por nome..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <span className="text-sm text-on-surface-variant">
            {totalElements} fornecedor{totalElements !== 1 ? 'es' : ''} cadastrado{totalElements !== 1 ? 's' : ''}
          </span>
        </section>

        <section className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase w-1/3">
                    Nome do Fornecedor
                  </th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase w-1/2">
                    Observações
                  </th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-on-surface-variant text-body-md">
                      Carregando...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-on-surface-variant text-body-md">
                      Nenhum fornecedor encontrado.
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-container transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${getAvatarColor(s.id)}`}
                          >
                            {getInitials(s.name)}
                          </div>
                          <div>
                            <p className="font-bold text-on-surface">{s.name}</p>
                            <p className="text-xs text-on-surface-variant font-mono">
                              {s.id.slice(-8).toUpperCase()}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-body-md text-on-surface-variant truncate max-w-md">
                          {s.notes || <span className="italic opacity-50">Sem observações</span>}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(s)}
                            className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg"
                            title="Editar"
                          >
                            <span className="material-symbols-outlined">edit</span>
                          </button>
                          <button
                            onClick={() => setDeleteTarget(s.id)}
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
                de <span className="font-bold text-on-surface">{totalElements}</span> fornecedores
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

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">factory</span>
              <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Total</span>
            </div>
            <p className="text-sm font-medium text-on-surface-variant">Total Cadastrados</p>
            <p className="text-h2 text-on-surface">{loading ? '—' : totalElements}</p>
          </div>

          <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="material-symbols-outlined text-tertiary bg-tertiary/10 p-2 rounded-lg">local_shipping</span>
            </div>
            <p className="text-sm font-medium text-on-surface-variant">Página Atual</p>
            <p className="text-h2 text-on-surface">{loading ? '—' : filtered.length}</p>
          </div>

          <div className="bg-on-secondary-fixed text-white rounded-xl p-5 shadow-lg shadow-primary/20 flex flex-col justify-center">
            <p className="text-sm font-bold opacity-80">Rede de Fornecimento</p>
            <div className="flex items-end gap-2 mt-1">
              <p className="text-h2">{loading ? '—' : totalElements}</p>
              <span className="material-symbols-outlined mb-2 text-white/60">factory</span>
            </div>
            <p className="text-xs text-white/60 mt-2">parceiros ativos na rede</p>
          </div>
        </section>
      </div>

      <Modal
        open={showForm}
        onClose={closeForm}
        title={editing ? 'Editar Fornecedor' : 'Novo Fornecedor'}
        maxWidth="max-w-lg"
      >
        <SupplierForm
          initial={editing}
          onSubmit={editing ? handleEdit : handleCreate}
          onClose={closeForm}
        />
      </Modal>

      <ConfirmModal
        open={deleteTarget !== null}
        title="Excluir Fornecedor"
        message="Tem certeza que deseja excluir este fornecedor? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        danger
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
