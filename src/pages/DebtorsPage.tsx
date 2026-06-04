import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import type { ClientResponseDTO, SpringPage } from '../types';
import { formatBRL, getInitials } from '../utils/format';

const PAGE_SIZE = 20;

export function DebtorsPage() {
  const { http } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [debtors, setDebtors] = useState<ClientResponseDTO[]>([]);
  const [filtered, setFiltered] = useState<ClientResponseDTO[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'debt' | 'name'>('debt');
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    if (!http) return;
    setLoading(true);
    http.get<SpringPage<ClientResponseDTO>>('/clients', { params: { size: 1000 } })
      .then((res) => {
        const allDebtors = res.data.content
          .filter((c) => c.clientStatus === 'OVERDUE')
          .sort((a, b) => a.balance - b.balance); // most negative balance first
        setDebtors(allDebtors);
        setFiltered(allDebtors);
      })
      .catch(() => setDebtors([]))
      .finally(() => setLoading(false));
  }, [http]);

  useEffect(() => {
    let result = debtors;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) => c.name.toLowerCase().includes(q) || c.phone?.includes(q),
      );
    }
    if (sortBy === 'debt') {
      result = [...result].sort((a, b) => a.balance - b.balance);
    } else {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    }
    setFiltered(result);
    setCurrentPage(0);
  }, [searchQuery, sortBy, debtors]);

  const totalDebt = debtors.reduce((sum, c) => sum + (c.balance < 0 ? Math.abs(c.balance) : 0), 0);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  return (
    <>
      <TopBar />

      <div className="p-6 max-w-7xl mx-auto w-full space-y-6">

        {/* Header */}
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-h1 text-slate-800">Fiados</h1>
            <p className="text-body-lg text-slate-500">
              {loading ? 'Carregando...' : (
                debtors.length > 0
                  ? <><span className="font-semibold text-red-600">{debtors.length}</span> clientes com débito em aberto</>
                  : 'Nenhum cliente com débito.'
              )}
            </p>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-500" style={{ fontSize: '18px' }}>group</span>
              </div>
              <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Devedores</span>
            </div>
            <p className="text-2xl font-black text-slate-800">{loading ? '—' : debtors.length}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-500" style={{ fontSize: '18px' }}>account_balance_wallet</span>
              </div>
              <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Dívida Total</span>
            </div>
            <p className="text-2xl font-black text-red-600">{loading ? '—' : formatBRL(totalDebt)}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-orange-500" style={{ fontSize: '18px' }}>trending_down</span>
              </div>
              <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Ticket Médio</span>
            </div>
            <p className="text-2xl font-black text-slate-800">
              {loading || debtors.length === 0 ? '—' : formatBRL(totalDebt / debtors.length)}
            </p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-xs">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: '18px' }}>search</span>
            <input
              type="text"
              placeholder="Buscar por nome ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl bg-white text-[13px] text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
            />
          </div>

          <div className="h-6 w-px bg-slate-200" />

          <span className="text-[12px] text-slate-500 font-medium">Ordenar por:</span>
          {([
            { key: 'debt', label: 'Maior dívida' },
            { key: 'name', label: 'Nome' },
          ] as const).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${
                sortBy === opt.key
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Telefone</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Dívida</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-[13px] text-slate-400">Carregando...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center">
                      <span className="material-symbols-outlined block mb-2 text-slate-200" style={{ fontSize: '40px' }}>
                        {debtors.length === 0 ? 'check_circle' : 'search_off'}
                      </span>
                      <p className="text-[13px] text-slate-400 font-medium">
                        {debtors.length === 0 ? 'Nenhum cliente com débito. Ótimo!' : 'Nenhum resultado encontrado.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginated.map((client) => {
                    const debt = client.balance < 0 ? Math.abs(client.balance) : 0;
                    const isRetail = client.clientType === 'RETAIL';
                    const urgency = debt > 200 ? 'text-red-600' : debt > 50 ? 'text-orange-600' : debt > 0 ? 'text-amber-600' : 'text-slate-400';
                    return (
                      <tr
                        key={client.id}
                        className="hover:bg-red-50/30 transition-colors cursor-pointer"
                        onClick={() => navigate(`/clients/${client.id}`)}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center font-bold text-[11px] text-red-600 flex-shrink-0">
                              {getInitials(client.name)}
                            </div>
                            <div>
                              <p className="text-[13px] font-semibold text-slate-800">{client.name}</p>
                              {client.address && (
                                <p className="text-[11px] text-slate-400">{client.address}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-3.5 text-[13px] text-slate-500 tabular-nums">
                          {client.phone ?? '—'}
                        </td>

                        <td className="px-5 py-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            isRetail ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'
                          }`}>
                            {isRetail ? 'Varejo' : 'Revendedor'}
                          </span>
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <span className={`text-[15px] font-black tabular-nums ${urgency}`}>
                            {debt > 0 ? formatBRL(debt) : '—'}
                          </span>
                          {debt === 0 && (
                            <p className="text-[10px] text-slate-400 mt-0.5">ver pedidos</p>
                          )}
                        </td>

                        <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => navigate(`/clients/${client.id}`)}
                              title="Ver cliente"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/8 transition-all"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>visibility</span>
                            </button>
                            <button
                              onClick={() => navigate(`/clients/${client.id}?tab=pagamentos`)}
                              title="Registrar pagamento"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-all"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>payments</span>
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
          {filtered.length > 0 && (
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <span className="text-[12px] text-slate-500">
                {Math.min(currentPage * PAGE_SIZE + 1, filtered.length)}–{Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)}
                {' '}<span className="text-slate-400">de</span>{' '}
                <span className="font-semibold text-slate-700">{filtered.length}</span> devedores
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-white transition-colors disabled:opacity-30"
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
                    className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-white transition-colors disabled:opacity-30"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
