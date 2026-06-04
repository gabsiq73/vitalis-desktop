import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import { ConfirmModal } from '../components/ConfirmModal';
import { NewClientModal } from '../modals/NewClientModal';
import type { ClientResponseDTO, SpringPage } from '../types';
import { formatBRL, getInitials } from '../utils/format';

const PAGE_SIZE = 20;

function getStatusBadge(status: string): { label: string; className: string } {
  return status === 'OVERDUE'
    ? { label: 'OVERDUE', className: 'bg-red-100 text-red-700' }
    : { label: 'PAID', className: 'bg-green-100 text-green-700' };
}

export function ClientsPage() {
  const { http } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientResponseDTO[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [showNewClient, setShowNewClient] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientResponseDTO | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function fetchClients() {
    if (!http) return;
    setLoading(true);
    const params: Record<string, string | number> = { page: currentPage, size: PAGE_SIZE };
    if (debouncedSearch) params.name = debouncedSearch;
    if (typeFilter) params.type = typeFilter;
    try {
      const res = await http.get<SpringPage<ClientResponseDTO>>('/clients', { params });
      setClients(res.data.content);
      setTotalElements(res.data.totalElements);
      setTotalPages(res.data.totalPages);
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchClients();
  }, [http, currentPage, debouncedSearch, typeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleTypeFilter(type: string) {
    setTypeFilter(type);
    setCurrentPage(0);
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    setCurrentPage(0);
  }

  function openEdit(client: ClientResponseDTO) {
    setEditingClient(client);
    setShowNewClient(true);
  }

  function closeClientModal() {
    setShowNewClient(false);
    setEditingClient(undefined);
  }

  async function deleteClient() {
    if (!http || !deleteTarget) return;
    setDeleteError('');
    try {
      await http.delete(`/clients/${deleteTarget}`);
      await fetchClients();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setDeleteError(message ?? 'Erro ao excluir cliente. Tente novamente.');
      throw err;
    }
  }

  const overdueCount = clients.filter((c) => c.balance < 0).length;
  const avgBalance =
    clients.length > 0 ? clients.reduce((sum, c) => sum + c.balance, 0) / clients.length : null;

  return (
    <>
      <TopBar />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-h1 text-on-surface">Lista de Clientes</h1>
            <p className="text-body-lg text-on-surface-variant">
              Gerencie todos os clientes cadastrados no sistema.
            </p>
          </div>
          <button
            onClick={() => { setEditingClient(undefined); setShowNewClient(true); }}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold shadow-md shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              person_add
            </span>
            Novo Cliente
          </button>
        </div>

        <section className="bg-surface border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">
                search
              </span>
              <input
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                placeholder="Buscar por nome..."
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <div className="flex items-center bg-surface-container-low border border-outline-variant rounded-lg p-1">
              {['', 'RETAIL', 'RESELLER'].map((type) => (
                <button
                  key={type}
                  onClick={() => handleTypeFilter(type)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${
                    typeFilter === type
                      ? 'bg-white shadow-sm text-primary'
                      : 'text-on-surface-variant hover:text-primary'
                  }`}
                >
                  {type || 'TODOS'}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">
                    Nome do Cliente
                  </th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">
                    Telefone
                  </th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">
                    Tipo
                  </th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">
                    Status
                  </th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase text-right">
                    Saldo
                  </th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase text-center">
                    Fidelidade
                  </th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase text-center">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-on-surface-variant text-body-md">
                      Carregando...
                    </td>
                  </tr>
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-on-surface-variant text-body-md">
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                ) : (
                  clients.map((client) => {
                    const status = getStatusBadge(client.clientStatus);
                    const isRetail = client.clientType === 'RETAIL';
                    return (
                      <tr
                        key={client.id}
                        className="hover:bg-surface-container transition-colors group cursor-pointer"
                        onClick={() => navigate(`/clients/${client.id}`)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                                isRetail
                                  ? 'bg-primary/5 text-primary'
                                  : 'bg-secondary-container/30 text-secondary'
                              }`}
                            >
                              {getInitials(client.name)}
                            </div>
                            <div>
                              <p className="font-bold text-on-surface">{client.name}</p>
                              <p className="text-xs text-on-surface-variant">{client.address ?? '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-body-md text-on-surface-variant">
                          {client.phone ?? '—'}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`text-[10px] font-black px-2 py-1 rounded ${
                              isRetail
                                ? 'bg-surface-container-highest text-on-surface'
                                : 'bg-primary-fixed text-on-primary-fixed-variant'
                            }`}
                          >
                            {client.clientType}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full font-semibold text-[11px] uppercase tracking-wide ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold">
                          <span className={client.balance < 0 ? 'text-error' : 'text-on-surface'}>
                            {formatBRL(client.balance)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {client.fidelityPoints > 0 || client.pendingBonusWater > 0 ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-sm font-bold text-tertiary">
                                {client.fidelityPoints.toLocaleString('pt-BR')} pts
                              </span>
                              {client.pendingBonusWater > 0 && (
                                <span className="text-[10px] font-bold text-tertiary bg-tertiary-fixed px-1.5 py-0.5 rounded-full">
                                  +{client.pendingBonusWater} galão
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-on-surface-variant text-sm">—</span>
                          )}
                        </td>
                        <td
                          className="px-6 py-4"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => navigate(`/clients/${client.id}`)}
                              className="p-2 text-primary hover:bg-primary/10 rounded-lg"
                              title="Ver"
                            >
                              <span className="material-symbols-outlined">visibility</span>
                            </button>
                            <button
                              onClick={() => openEdit(client)}
                              className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg"
                              title="Editar"
                            >
                              <span className="material-symbols-outlined">edit</span>
                            </button>
                            <button
                              onClick={() => setDeleteTarget(client.id)}
                              className="p-2 text-error hover:bg-error/10 rounded-lg"
                              title="Excluir"
                            >
                              <span className="material-symbols-outlined">delete</span>
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

          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-low flex items-center justify-between">
              <p className="text-sm text-on-surface-variant">
                Mostrando{' '}
                <span className="font-bold text-on-surface">
                  {Math.min(currentPage * PAGE_SIZE + 1, totalElements)}–
                  {Math.min((currentPage + 1) * PAGE_SIZE, totalElements)}
                </span>{' '}
                de <span className="font-bold text-on-surface">{totalElements}</span> clientes
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container disabled:opacity-30 transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    chevron_left
                  </span>
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
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    chevron_right
                  </span>
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">
                group
              </span>
              <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                Total
              </span>
            </div>
            <p className="text-sm font-medium text-on-surface-variant">Total Clientes</p>
            <p className="text-h2 text-on-surface">
              {loading ? '—' : totalElements.toLocaleString('pt-BR')}
            </p>
          </div>

          <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="material-symbols-outlined text-tertiary bg-tertiary/10 p-2 rounded-lg">
                warning
              </span>
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                {overdueCount} atrasos
              </span>
            </div>
            <p className="text-sm font-medium text-on-surface-variant">Inadimplentes</p>
            <p className="text-h2 text-on-surface">
              {loading || clients.length === 0
                ? '—'
                : `${((overdueCount / clients.length) * 100).toFixed(1)}%`}
            </p>
          </div>

          <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">
                payments
              </span>
              <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                Saudável
              </span>
            </div>
            <p className="text-sm font-medium text-on-surface-variant">Crédito Médio</p>
            <p className="text-h2 text-on-surface">
              {loading || avgBalance === null ? '—' : formatBRL(avgBalance)}
            </p>
          </div>

          <div className="bg-primary text-white rounded-xl p-5 shadow-lg shadow-primary/20 flex flex-col justify-center">
            <p className="text-sm font-bold opacity-80">Meta de Retenção</p>
            <div className="flex items-end gap-2 mt-1">
              <p className="text-h2">92%</p>
              <span className="material-symbols-outlined mb-2 text-white/60">trending_up</span>
            </div>
            <div className="w-full bg-white/20 h-1.5 rounded-full mt-4">
              <div className="bg-white h-full rounded-full w-[92%]" />
            </div>
          </div>
        </section>
      </div>

      <NewClientModal
        open={showNewClient}
        onClose={closeClientModal}
        onSuccess={() => { closeClientModal(); fetchClients(); }}
        client={editingClient}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        title="Excluir Cliente"
        message="Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        danger
        error={deleteError}
        onConfirm={deleteClient}
        onClose={() => { setDeleteTarget(null); setDeleteError(''); }}
      />
    </>
  );
}
