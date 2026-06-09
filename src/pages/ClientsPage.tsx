import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../contexts/NotificationContext';
import { TopBar } from '../components/TopBar';
import { ConfirmModal } from '../components/ConfirmModal';
import { NewClientModal } from '../modals/NewClientModal';
import { SortableHeader } from '../components/SortableHeader';
import type { SortState } from '../components/SortableHeader';
import { PageSizeSelector } from '../components/PageSizeSelector';
import type { ClientResponseDTO, SpringPage } from '../types';
import { formatBRL, getInitials, maskPhone } from '../utils/format';


const TYPE_CHIPS = [
  {
    key: '',
    label: 'Todos',
    icon: 'groups',
    inactive: 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50',
    active: 'bg-slate-800 border-slate-800 text-white',
  },
  {
    key: 'RETAIL',
    label: 'Varejo',
    icon: 'person',
    inactive: 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50',
    active: 'bg-blue-50 border-blue-400 text-blue-800',
  },
  {
    key: 'RESELLER',
    label: 'Revendedor',
    icon: 'storefront',
    inactive: 'bg-white border-slate-200 text-slate-600 hover:border-violet-400 hover:bg-violet-50',
    active: 'bg-violet-600 border-violet-600 text-white',
  },
];

interface ClientStats {
  total: number;
  overdueCount: number;
  overduePercent: number;
  totalBalance: number;
  adimplenceRate: number;
}

export function ClientsPage() {
  const { http } = useAuth();
  const navigate = useNavigate();
  const { notify } = useNotification();

  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientResponseDTO[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [stats, setStats] = useState<ClientStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [sort, setSort] = useState<SortState | null>(null);
  const [pageSize, setPageSize] = useState(20);

  const [showNewClient, setShowNewClient] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientResponseDTO | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function fetchClients() {
    if (!http) return;
    setLoading(true);
    const params: Record<string, string | number> = { page: currentPage, size: pageSize };
    if (debouncedSearch) params.name = debouncedSearch;
    if (typeFilter) params.type = typeFilter;
    if (sort) params.sort = `${sort.field},${sort.dir}`;
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

  async function fetchStats() {
    if (!http) return;
    setStatsLoading(true);
    try {
      const res = await http.get<SpringPage<ClientResponseDTO>>('/clients', {
        params: { size: 1000, sort: 'name,asc' },
      });
      const all = res.data.content;
      const total = res.data.totalElements;
      const overdueCount = all.filter((c) => c.clientStatus === 'OVERDUE').length;
      const totalBalance = all.reduce((sum, c) => sum + c.balance, 0);
      setStats({
        total,
        overdueCount,
        overduePercent: total > 0 ? (overdueCount / total) * 100 : 0,
        totalBalance,
        adimplenceRate: total > 0 ? ((total - overdueCount) / total) * 100 : 100,
      });
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }

  useEffect(() => {
    fetchClients();
  }, [http, currentPage, debouncedSearch, typeFilter, sort, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchStats();
  }, [http]); // eslint-disable-line react-hooks/exhaustive-deps

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
      notify('Cliente excluído com sucesso.', 'success');
      await fetchClients();
      await fetchStats();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const msg = message ?? 'Erro ao excluir cliente. Tente novamente.';
      setDeleteError(msg);
      throw err;
    }
  }

  const KPI_CARDS = [
    {
      icon: 'group',
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      label: 'Total de Clientes',
      value: statsLoading ? '—' : (stats?.total ?? 0).toLocaleString('pt-BR'),
      badge: null,
      badgeColor: '',
    },
    {
      icon: 'warning',
      iconBg: 'bg-red-50',
      iconColor: 'text-red-500',
      label: 'Inadimplentes',
      value: statsLoading ? '—' : `${stats?.overduePercent.toFixed(1) ?? '0.0'}%`,
      badge: statsLoading ? null : `${stats?.overdueCount ?? 0} clientes`,
      badgeColor: (stats?.overdueCount ?? 0) > 0 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50',
    },
    {
      icon: 'account_balance_wallet',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      label: 'Saldo Total da Carteira',
      value: statsLoading ? '—' : formatBRL(stats?.totalBalance ?? 0),
      badge: null,
      badgeColor: '',
    },
    {
      icon: 'verified_user',
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      label: 'Taxa de Adimplência',
      value: statsLoading ? '—' : `${stats?.adimplenceRate.toFixed(1) ?? '100.0'}%`,
      badge: null,
      badgeColor: '',
      progress: stats?.adimplenceRate,
    },
  ];

  return (
    <>
      <TopBar />

      <div className="p-6 max-w-7xl mx-auto w-full space-y-6">

        {/* Header */}
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-h1 text-slate-800">Clientes</h1>
            <p className="text-body-lg text-slate-500">
              {stats && !statsLoading
                ? <><span className="font-semibold text-slate-700">{stats.total}</span> clientes cadastrados</>
                : 'Gerencie todos os clientes cadastrados no sistema.'}
            </p>
          </div>
          <button
            onClick={() => { setEditingClient(undefined); setShowNewClient(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-[13px] font-bold shadow-md shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_add</span>
            Novo Cliente
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px] max-w-xs">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: '18px' }}>
              search
            </span>
            <input
              type="text"
              placeholder="Buscar por nome..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl bg-white text-[13px] text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
            />
          </div>

          <div className="h-6 w-px bg-slate-200" />

          {/* Type chips */}
          {TYPE_CHIPS.map((chip) => (
            <button
              key={chip.key || 'all'}
              onClick={() => handleTypeFilter(chip.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold text-[13px] transition-all shadow-sm ${
                typeFilter === chip.key ? chip.active : chip.inactive
              }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{chip.icon}</span>
              {chip.label}
            </button>
          ))}

          {(searchQuery || typeFilter) && (
            <button
              onClick={() => { setSearchQuery(''); setTypeFilter(''); setCurrentPage(0); }}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-[12px] font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>close</span>
              Limpar
            </button>
          )}

          <div className="ml-auto">
            <PageSizeSelector value={pageSize} onChange={(s) => { setPageSize(s); setCurrentPage(0); }} />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider"><SortableHeader label="Cliente" field="name" sort={sort} onSort={setSort} defaultDir="asc" /></th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Telefone</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider"><SortableHeader label="Tipo" field="clientType" sort={sort} onSort={setSort} defaultDir="asc" /></th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider"><SortableHeader label="Status" field="clientStatus" sort={sort} onSort={setSort} defaultDir="asc" /></th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right"><SortableHeader label="Saldo" field="balance" sort={sort} onSort={setSort} defaultDir="desc" /></th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center">Fidelidade</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center">Pedidos</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Ações</th>
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
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center">
                      <span className="material-symbols-outlined block mb-2 text-slate-200" style={{ fontSize: '36px' }}>person_off</span>
                      <p className="text-[13px] text-slate-400">Nenhum cliente encontrado.</p>
                      {(searchQuery || typeFilter) && (
                        <button
                          onClick={() => { setSearchQuery(''); setTypeFilter(''); }}
                          className="mt-2 text-[12px] text-primary hover:underline"
                        >
                          Limpar filtros
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  clients.map((client) => {
                    const isRetail = client.clientType === 'RETAIL';
                    const isOverdue = client.clientStatus === 'OVERDUE';
                    return (
                      <tr
                        key={client.id}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                        onClick={() => navigate(`/clients/${client.id}`)}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] flex-shrink-0 ${
                              isRetail ? 'bg-blue-50 text-blue-600' : 'bg-violet-600 text-white'
                            }`}>
                              {getInitials(client.name)}
                            </div>
                            <div>
                              <p className="text-[13px] font-semibold text-slate-800">{client.name}</p>
                              <p className="text-[11px] text-slate-400">{client.address ?? '—'}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-3.5 text-[13px] text-slate-500 tabular-nums">
                          {client.phone ? maskPhone(client.phone) : '—'}
                        </td>

                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                            isRetail
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-violet-600 text-white'
                          }`}>
                            {!isRetail && <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>storefront</span>}
                            {isRetail ? 'Varejo' : 'Revendedor'}
                          </span>
                        </td>

                        <td className="px-5 py-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                            isOverdue ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
                          }`}>
                            {isOverdue ? 'Inadimplente' : 'Adimplente'}
                          </span>
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <span className={`text-[13px] font-bold tabular-nums ${client.balance < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                            {formatBRL(client.balance)}
                          </span>
                        </td>

                        <td className="px-5 py-3.5 text-center">
                          {client.fidelityPoints > 0 || client.pendingBonusWater > 0 ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[12px] font-bold text-amber-600">
                                {client.fidelityPoints.toLocaleString('pt-BR')} pts
                              </span>
                              {client.pendingBonusWater > 0 && (
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                                  +{client.pendingBonusWater} galão
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[12px] text-slate-300">—</span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 text-center">
                          <span className="text-[13px] font-semibold text-slate-700">
                            {client.orderCount ?? '—'}
                          </span>
                        </td>

                        <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              onClick={() => navigate(`/clients/${client.id}`)}
                              title="Ver detalhes"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/8 transition-all"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>visibility</span>
                            </button>
                            <button
                              onClick={() => openEdit(client)}
                              title="Editar"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                            </button>
                            <button
                              onClick={() => setDeleteTarget(client.id)}
                              title="Excluir"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                            >
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
          {totalElements > 0 && (
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <span className="text-[12px] text-slate-500">
                {Math.min(currentPage * pageSize + 1, totalElements)}–{Math.min((currentPage + 1) * pageSize, totalElements)}
                {' '}<span className="text-slate-400">de</span>{' '}
                <span className="font-semibold text-slate-700">{totalElements}</span> clientes
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const start = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
                    return start + i;
                  }).map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-[13px] font-semibold transition-colors ${
                        pageNum === currentPage
                          ? 'bg-primary text-white'
                          : 'text-slate-500 hover:bg-white border border-transparent hover:border-slate-200'
                      }`}
                    >
                      {pageNum + 1}
                    </button>
                  ))}
                  <button
                    disabled={currentPage >= totalPages - 1}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {KPI_CARDS.map((card, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.iconBg}`}>
                  <span className={`material-symbols-outlined ${card.iconColor}`} style={{ fontSize: '20px' }}>
                    {card.icon}
                  </span>
                </div>
                {card.badge && (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${card.badgeColor}`}>
                    {card.badge}
                  </span>
                )}
              </div>
              <p className="text-[12px] font-medium text-slate-500 mb-0.5">{card.label}</p>
              <p className="text-2xl font-black text-slate-800">{card.value}</p>
              {card.progress !== undefined && (
                <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full transition-all"
                    style={{ width: `${card.progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

      </div>

      <NewClientModal
        open={showNewClient}
        onClose={closeClientModal}
        onSuccess={() => { closeClientModal(); fetchClients(); fetchStats(); }}
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
