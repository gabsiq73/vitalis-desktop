import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import { ConfirmModal } from '../components/ConfirmModal';
import { NewLoanModal } from '../modals/NewLoanModal';
import type { LoanedBottleResponseDTO, SpringPage } from '../types';
import { getInitials } from '../utils/format';

const PAGE_SIZE = 20;

function daysSince(dateStr?: string): number | null {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function getDaysBadge(days: number | null): { label: string; className: string } {
  if (days === null) return { label: '—', className: 'bg-surface-container text-on-surface-variant' };
  if (days > 180) return { label: `${days} dias`, className: 'bg-error-container text-on-error-container' };
  if (days > 30) return { label: `${days} dias`, className: 'bg-tertiary-fixed text-on-tertiary-fixed-variant' };
  return { label: `${days} dias`, className: 'bg-secondary-container text-on-secondary-container' };
}

function getStatusBadge(status: string): { label: string; className: string } {
  if (status.toUpperCase() === 'RETURNED') {
    return { label: 'Devolvido', className: 'bg-green-100 text-green-700' };
  }
  return { label: 'Pendente', className: 'bg-orange-100 text-orange-700' };
}

export function BottlesPage() {
  const { http } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [bottles, setBottles] = useState<LoanedBottleResponseDTO[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');

  const [showNewLoan, setShowNewLoan] = useState(false);
  const [returnTarget, setReturnTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  function fetchBottles() {
    if (!http) return;
    setLoading(true);
    const params: Record<string, string | number> = { page: currentPage, size: PAGE_SIZE };
    if (statusFilter) params.status = statusFilter;
    http
      .get<SpringPage<LoanedBottleResponseDTO>>('/bottles', { params })
      .then((res) => {
        setBottles(res.data.content);
        setTotalElements(res.data.totalElements);
        setTotalPages(res.data.totalPages);
      })
      .catch(() => setBottles([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchBottles(); }, [http, currentPage, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleStatusFilter(s: string) {
    setStatusFilter(s);
    setCurrentPage(0);
  }

  async function handleReturn() {
    if (!http || !returnTarget) return;
    await http.patch(`/bottles/${returnTarget}/return`);
    fetchBottles();
  }

  async function handleDelete() {
    if (!http || !deleteTarget) return;
    await http.delete(`/bottles/${deleteTarget}`);
    fetchBottles();
  }

  const pendingCount = bottles.filter((b) => b.status.toUpperCase() !== 'RETURNED').length;
  const overdueCount = bottles.filter((b) => {
    const days = daysSince(b.loanDate);
    return days !== null && days > 30 && b.status.toUpperCase() !== 'RETURNED';
  }).length;

  return (
    <>
      <TopBar />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-h1 text-on-surface">Vasilhames Emprestados</h1>
            <p className="text-body-lg text-on-surface-variant">
              Gerencie os ativos em circulação com clientes e parceiros.
            </p>
          </div>
          <button
            onClick={() => setShowNewLoan(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold shadow-md shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            Registrar Empréstimo
          </button>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">propane_tank</span>
              <span className="text-xs font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
                Total
              </span>
            </div>
            <p className="text-sm font-medium text-on-surface-variant">Total em Aberto</p>
            <p className="text-h2 text-on-surface">{loading ? '—' : totalElements.toLocaleString('pt-BR')}</p>
          </div>

          <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="material-symbols-outlined text-tertiary bg-tertiary/10 p-2 rounded-lg">warning</span>
              {overdueCount > 0 && (
                <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                  alerta
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-on-surface-variant">Atrasos (&gt;30 dias)</p>
            <p className={`text-h2 ${overdueCount > 0 ? 'text-tertiary' : 'text-on-surface'}`}>
              {loading ? '—' : overdueCount}
            </p>
          </div>

          <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">
                assignment_return
              </span>
            </div>
            <p className="text-sm font-medium text-on-surface-variant">Pendentes (Página)</p>
            <p className="text-h2 text-on-surface">{loading ? '—' : pendingCount}</p>
          </div>

          <div className="bg-on-secondary-fixed text-white rounded-xl p-5 shadow-lg shadow-primary/20 flex flex-col justify-center">
            <p className="text-sm font-bold opacity-80">Ativos Circulantes</p>
            <div className="flex items-end gap-2 mt-1">
              <p className="text-h2">{loading ? '—' : totalElements.toLocaleString('pt-BR')}</p>
              <span className="material-symbols-outlined mb-2 text-white/60">propane_tank</span>
            </div>
            <p className="text-xs text-white/60 mt-2">vasilhames em campo</p>
          </div>
        </section>

        <section className="bg-surface border border-outline-variant rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="flex items-center bg-surface-container-low border border-outline-variant rounded-lg p-1">
            {[
              { value: '', label: 'TODOS' },
              { value: 'PENDING', label: 'PENDENTES' },
              { value: 'RETURNED', label: 'DEVOLVIDOS' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleStatusFilter(opt.value)}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${
                  statusFilter === opt.value
                    ? 'bg-white shadow-sm text-primary'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        <section className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-3 bg-surface-container-low border-b border-outline-variant flex items-center gap-3">
            <h3 className="text-h3 text-on-surface">Lista de Pendências</h3>
            <span className="bg-primary-fixed text-on-primary-fixed-variant px-2 py-0.5 rounded text-[10px] font-bold uppercase">
              Ordenado por Antiguidade
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">Cliente</th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">Produto</th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">Qtd</th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">Data Empréstimo</th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">Dias em Aberto</th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">Status</th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-on-surface-variant text-body-md">
                      Carregando...
                    </td>
                  </tr>
                ) : bottles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-on-surface-variant text-body-md">
                      Nenhum vasilhame encontrado.
                    </td>
                  </tr>
                ) : (
                  bottles.map((b) => {
                    const days = b.returnDate ? null : daysSince(b.loanDate);
                    const daysBadge = getDaysBadge(days);
                    const statusBadge = getStatusBadge(b.status);
                    const isReturned = b.status.toUpperCase() === 'RETURNED';
                    return (
                      <tr key={b.id} className="hover:bg-surface-container transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary-fixed text-on-primary-fixed-variant flex items-center justify-center font-bold text-xs flex-shrink-0">
                              {getInitials(b.clientName)}
                            </div>
                            <p className="font-bold text-on-surface">{b.clientName}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 text-body-md text-on-surface">
                            <span className="material-symbols-outlined text-primary-container" style={{ fontSize: '18px' }}>
                              propane_tank
                            </span>
                            {b.productName}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-on-surface">{b.quantity}</td>
                        <td className="px-6 py-4 text-on-surface-variant">
                          {b.loanDate
                            ? new Date(b.loanDate).toLocaleDateString('pt-BR')
                            : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${daysBadge.className}`}>
                            {isReturned
                              ? b.returnDate
                                ? new Date(b.returnDate).toLocaleDateString('pt-BR')
                                : 'Devolvido'
                              : daysBadge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide ${statusBadge.className}`}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => navigate(`/clients/${b.clientId}`)}
                              className="p-2 text-primary hover:bg-primary/10 rounded-lg"
                              title="Ver Cliente"
                            >
                              <span className="material-symbols-outlined">visibility</span>
                            </button>
                            {!isReturned && (
                              <button
                                onClick={() => setReturnTarget(b.id)}
                                className="p-2 text-primary hover:bg-secondary-container rounded-lg"
                                title="Registrar Devolução"
                              >
                                <span className="material-symbols-outlined">keyboard_return</span>
                              </button>
                            )}
                            <button
                              onClick={() => setDeleteTarget(b.id)}
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
                de <span className="font-bold text-on-surface">{totalElements}</span> registros
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

      <NewLoanModal
        open={showNewLoan}
        onClose={() => setShowNewLoan(false)}
        onSuccess={fetchBottles}
      />

      <ConfirmModal
        open={returnTarget !== null}
        title="Registrar Devolução"
        message="Confirmar a devolução deste vasilhame? O status será atualizado para devolvido."
        confirmLabel="Confirmar Devolução"
        onConfirm={handleReturn}
        onClose={() => setReturnTarget(null)}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        title="Excluir Registro"
        message="Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        danger
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
