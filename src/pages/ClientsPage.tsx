import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { ClientResponseDTO, SpringPage } from '../types';

const PAGE_SIZE = 20;

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

function getStatusBadge(balance: number): { label: string; className: string } {
  return balance < 0
    ? { label: 'OVERDUE', className: 'bg-red-100 text-red-700' }
    : { label: 'PAID', className: 'bg-green-100 text-green-700' };
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function ClientsPage() {
  const { http, auth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientResponseDTO[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!http) return;

    setLoading(true);
    const params: Record<string, string | number> = { page: currentPage, size: PAGE_SIZE };
    if (debouncedSearch) params.name = debouncedSearch;
    if (typeFilter) params.type = typeFilter;

    http
      .get<SpringPage<ClientResponseDTO>>('/clients', { params })
      .then((res) => {
        setClients(res.data.content);
        setTotalElements(res.data.totalElements);
        setTotalPages(res.data.totalPages);
      })
      .catch(() => setClients([]))
      .finally(() => setLoading(false));
  }, [http, currentPage, debouncedSearch, typeFilter]);

  function handleTypeFilter(type: string) {
    setTypeFilter(type);
    setCurrentPage(0);
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    setCurrentPage(0);
  }

  const overdueCount = clients.filter((c) => c.balance < 0).length;
  const avgBalance =
    clients.length > 0 ? clients.reduce((sum, c) => sum + c.balance, 0) / clients.length : null;

  return (
    <>
      <header className="h-16 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-outline-variant/30">
        <div className="flex items-center gap-3">
          <span className="text-h2 text-on-surface">Lista de Clientes</span>
          <span className="bg-primary-fixed text-on-primary-fixed-variant text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">
            Enterprise
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors">
            <span className="material-symbols-outlined">settings</span>
          </button>
          <div className="h-px w-4" />
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-on-surface leading-none">
                {auth?.username ?? 'Admin'}
              </p>
              <p className="text-[10px] text-on-surface-variant font-medium uppercase tracking-wider">
                Supervisor
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center text-on-primary-container font-bold border-2 border-primary-fixed">
              {auth?.username?.charAt(0).toUpperCase() ?? 'A'}
            </div>
          </div>
        </div>
      </header>

      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <section className="bg-white border border-outline-variant/30 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">
                search
              </span>
              <input
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                placeholder="Buscar por nome, telefone ou documento..."
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
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2.5 border border-outline-variant rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                filter_list
              </span>
              Filtros Avançados
            </button>
            <button className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-bold shadow-md shadow-primary/20 hover:brightness-110 active:scale-95 transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                person_add
              </span>
              Novo Cliente
            </button>
          </div>
        </section>

        <section className="bg-white border border-outline-variant/30 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/50 border-b border-outline-variant/30">
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
                    Saldo de Crédito
                  </th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase text-center">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant text-body-md">
                      Carregando...
                    </td>
                  </tr>
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant text-body-md">
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                ) : (
                  clients.map((client) => {
                    const status = getStatusBadge(client.balance);
                    const isRetail = client.type === 'RETAIL';
                    return (
                      <tr
                        key={client.id}
                        className="hover:bg-surface-container-lowest transition-all duration-150 group"
                        style={{ transition: 'transform 150ms ease' }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.transform =
                            'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.transform =
                            'translateY(0)';
                        }}
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
                              <p className="text-xs text-on-surface-variant">
                                {client.email ?? '—'}
                              </p>
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
                            {client.type}
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
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              className="p-2 text-primary hover:bg-primary/10 rounded-lg"
                              title="Ver"
                            >
                              <span className="material-symbols-outlined">visibility</span>
                            </button>
                            <button
                              className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg"
                              title="Editar"
                            >
                              <span className="material-symbols-outlined">edit</span>
                            </button>
                            <button
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
            <div className="px-6 py-4 border-t border-outline-variant/30 bg-surface-container-low/30 flex items-center justify-between">
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
          <div className="bg-white border border-outline-variant/30 rounded-xl p-5 shadow-sm">
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

          <div className="bg-white border border-outline-variant/30 rounded-xl p-5 shadow-sm">
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

          <div className="bg-white border border-outline-variant/30 rounded-xl p-5 shadow-sm">
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
    </>
  );
}
