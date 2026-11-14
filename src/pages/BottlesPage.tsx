import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import { ConfirmModal } from '../components/ConfirmModal';
import { SortableHeader } from '../components/SortableHeader';
import type { SortState } from '../components/SortableHeader';
import { applySortInMemory } from '../utils/sort';
import { NewLoanModal } from '../modals/NewLoanModal';
import { NewBottleDebtModal } from '../modals/NewBottleDebtModal';
import { useNotification } from '../hooks/useNotification';
import { parseApiError } from '../utils/parseApiError';
import { PageSizeSelector } from '../components/PageSizeSelector';
import type { ClientResponseDTO, DepotBottleDebtResponseDTO, LoanedBottleResponseDTO, SpringPage } from '../types';
import { getInitials } from '../utils/format';

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
  const [sort, setSort] = useState<SortState | null>(null);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [pageSize, setPageSize] = useState(15);

  const [showNewLoan, setShowNewLoan] = useState(false);
  const [editLoan, setEditLoan] = useState<LoanedBottleResponseDTO | null>(null);
  const [returnTarget, setReturnTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { notify } = useNotification();
  const [clients, setClients] = useState<ClientResponseDTO[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState('');
  const [debts, setDebts] = useState<SpringPage<DepotBottleDebtResponseDTO> | null>(null);
  const [debtsLoading, setDebtsLoading] = useState(true);
  const [debtsError, setDebtsError] = useState('');
  const [debtClientId, setDebtClientId] = useState('');
  const [debtPage, setDebtPage] = useState(0);
  const [debtPageSize, setDebtPageSize] = useState(15);
  const [debtRefresh, setDebtRefresh] = useState(0);
  const [showNewDebt, setShowNewDebt] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<DepotBottleDebtResponseDTO | null>(null);
  const [completeError, setCompleteError] = useState('');
  const completing = useRef(false);

  useEffect(() => {
    if (!http) return;
    let active = true;
    setClientsLoading(true);
    setClientsError('');
    async function loadClients() {
      try {
        const all: ClientResponseDTO[] = [];
        let page = 0;
        let total = 1;
        while (page < total) {
          const response = await http!.get<SpringPage<ClientResponseDTO>>('/clients', { params: { page, size: 200, sort: 'name,asc' } });
          if (!active) return;
          all.push(...response.data.content);
          total = response.data.totalPages;
          page++;
        }
        if (active) setClients(all);
      } catch (err) {
        if (active) setClientsError(parseApiError(err));
      } finally {
        if (active) setClientsLoading(false);
      }
    }
    void loadClients();
    return () => { active = false; };
  }, [http, debtRefresh]);

  useEffect(() => {
    if (!http) return;
    let active = true;
    setDebtsLoading(true);
    setDebtsError('');
    http.get<SpringPage<DepotBottleDebtResponseDTO>>('/depot-bottle-debts', {
      params: { page: debtPage, size: debtPageSize, sort: 'debtDate,asc', ...(debtClientId ? { clientId: debtClientId } : {}) },
    }).then(response => {
      if (!active) return;
      if (debtPage > 0 && debtPage >= response.data.totalPages) {
        setDebtPage(Math.max(0, response.data.totalPages - 1));
      } else setDebts(response.data);
    }).catch(err => {
      if (active) { setDebts(null); setDebtsError(parseApiError(err)); }
    }).finally(() => { if (active) setDebtsLoading(false); });
    return () => { active = false; };
  }, [http, debtPage, debtPageSize, debtClientId, debtRefresh]);

  async function handleComplete() {
    if (!http || !completeTarget || completing.current) return false;
    completing.current = true;
    setCompleteError('');
    try {
      await http.patch(`/depot-bottle-debts/${completeTarget.id}/complete`);
      notify('Pendência de garrafões baixada.', 'success');
      setDebtRefresh(value => value + 1);
      return true;
    } catch (err) {
      setCompleteError(parseApiError(err));
      return false;
    } finally {
      completing.current = false;
    }
  }

  function fetchBottles() {
    if (!http) return;
    setLoading(true);
    const params: Record<string, string | number> = { page: currentPage, size: pageSize };
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

  useEffect(() => { fetchBottles(); }, [http, currentPage, statusFilter, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <h1 className="text-h1 text-on-surface">Vasilhames</h1>
        <section aria-labelledby="bottle-debts-title" className="bg-surface border border-outline-variant rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 id="bottle-debts-title" className="text-h2 text-on-surface">Garrafões devidos aos clientes</h2>
              <p className="text-sm text-on-surface-variant mt-1">Pendências do depósito com os clientes. A baixa entrega toda a quantidade registrada.</p>
            </div>
            <button disabled={clientsLoading || !!clientsError || clients.length === 0} onClick={() => setShowNewDebt(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-lg font-bold text-sm disabled:opacity-50">
              <span className="material-symbols-outlined" aria-hidden="true">add</span>Registrar pendência
            </button>
          </div>
          <div className="px-6 pb-4 flex flex-wrap items-end gap-4">
            <label className="text-sm text-on-surface-variant">Filtrar pendências por cliente
              <select disabled={clientsLoading || !!clientsError} value={debtClientId} onChange={e => { setDebtClientId(e.target.value); setDebtPage(0); }} className="block mt-1 px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest max-w-full">
                <option value="">{clientsLoading ? 'Carregando clientes...' : 'Todos os clientes'}</option>
                {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </label>
            <button onClick={() => setDebtRefresh(value => value + 1)} disabled={debtsLoading || clientsLoading} className="px-3 py-2 text-sm text-primary border border-outline-variant rounded-lg disabled:opacity-50">Atualizar</button>
            <div className="ml-auto"><PageSizeSelector value={debtPageSize} onChange={size => { setDebtPageSize(size); setDebtPage(0); }} /></div>
          </div>
          {clientsError && <p role="alert" className="px-6 pb-4 text-sm text-error">Não foi possível carregar os clientes: {clientsError} Use Atualizar para tentar novamente.</p>}
          {!clientsLoading && !clientsError && clients.length === 0 && <p className="px-6 pb-4 text-sm text-on-surface-variant">Cadastre um cliente para registrar uma pendência.</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low text-label-sm text-on-surface-variant uppercase">
                <tr>{['Cliente', 'Quantidade', 'Data', 'Situação', 'Observação', 'Ações'].map(label => <th key={label} className="px-6 py-4">{label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {debtsLoading ? <tr><td colSpan={6} className="px-6 py-10 text-center text-on-surface-variant">Carregando pendências...</td></tr>
                  : debtsError ? <tr><td colSpan={6} role="alert" className="px-6 py-10 text-center text-error">Não foi possível consultar as pendências: {debtsError} Use Atualizar para tentar novamente.</td></tr>
                  : !debts?.content.length ? <tr><td colSpan={6} className="px-6 py-10 text-center text-on-surface-variant">Nenhuma pendência de garrafões encontrada.</td></tr>
                  : debts.content.map(debt => <tr key={debt.id} className="hover:bg-surface-container">
                    <td className="px-6 py-4 font-bold text-on-surface">{debt.clientName}</td>
                    <td className="px-6 py-4 text-on-surface">{debt.quantity}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{new Date(debt.debtDate).toLocaleDateString('pt-BR')}</td>
                    <td className="px-6 py-4"><span className="px-3 py-1 rounded-full text-xs bg-orange-100 text-orange-700">{debt.status === 'PENDING' ? 'Pendente' : 'Concluída'}</span></td>
                    <td className="px-6 py-4 text-on-surface-variant whitespace-pre-wrap break-words max-w-xs">{debt.notes || '—'}</td>
                    <td className="px-6 py-4">{debt.status === 'PENDING' && <button onClick={() => { setCompleteError(''); setCompleteTarget(debt); }} className="px-3 py-2 text-sm font-bold text-primary hover:bg-secondary-container rounded-lg">Baixar pendência</button>}</td>
                  </tr>)}
              </tbody>
            </table>
          </div>
          {!debtsLoading && !debtsError && debts && <div className="px-6 py-4 border-t border-outline-variant flex flex-wrap justify-between items-center gap-3 text-sm text-on-surface-variant">
            <span>{debts.totalElements} pendência(s){debts.totalPages > 0 ? ` · Página ${debtPage + 1} de ${debts.totalPages}` : ''}</span>
            {debts.totalPages > 1 && <div className="flex gap-3">
              <button disabled={debtPage === 0} onClick={() => setDebtPage(page => page - 1)} className="px-3 py-2 rounded-lg border border-outline-variant disabled:opacity-30">Anterior</button>
              <button disabled={debtPage >= debts.totalPages - 1} onClick={() => setDebtPage(page => page + 1)} className="px-3 py-2 rounded-lg border border-outline-variant disabled:opacity-30">Próxima</button>
            </div>}
          </div>}
        </section>

        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-h2 text-on-surface">Vasilhames Emprestados</h2>
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
          <div className="ml-auto">
            <PageSizeSelector value={pageSize} onChange={(s) => { setPageSize(s); setCurrentPage(0); }} />
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
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase"><SortableHeader label="Cliente" field="clientName" sort={sort} onSort={setSort} defaultDir="asc" /></th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase"><SortableHeader label="Produto" field="productName" sort={sort} onSort={setSort} defaultDir="asc" /></th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase"><SortableHeader label="Qtd" field="quantity" sort={sort} onSort={setSort} defaultDir="desc" /></th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase"><SortableHeader label="Data Empréstimo" field="loanDate" sort={sort} onSort={setSort} defaultDir="desc" /></th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">Dias em Aberto</th>
                  <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase"><SortableHeader label="Status" field="status" sort={sort} onSort={setSort} defaultDir="asc" /></th>
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
                  applySortInMemory(bottles, sort).map((b) => {
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
                              <button title="Editar empréstimo" onClick={() => setEditLoan(b)} className="p-2 text-primary rounded-lg hover:bg-primary/10"><span className="material-symbols-outlined">edit</span></button>
                            )}
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
                  {Math.min(currentPage * pageSize + 1, totalElements)}–
                  {Math.min((currentPage + 1) * pageSize, totalElements)}
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

      {editLoan && <NewLoanModal open loan={editLoan} onClose={() => setEditLoan(null)} onSuccess={() => { setEditLoan(null); fetchBottles(); }} />}
      <NewLoanModal
        open={showNewLoan}
        onClose={() => setShowNewLoan(false)}
        onSuccess={fetchBottles}
      />

      {showNewDebt && <NewBottleDebtModal clients={clients} onClose={() => setShowNewDebt(false)} onSuccess={() => { setShowNewDebt(false); setDebtPage(0); setDebtRefresh(value => value + 1); }} />}

      <ConfirmModal
        open={completeTarget !== null}
        title="Baixar pendência de garrafões"
        message={`Confirma a entrega de todos os ${completeTarget?.quantity ?? ''} garrafões devidos a ${completeTarget?.clientName ?? ''}? A baixa é integral.`}
        confirmLabel="Confirmar baixa"
        error={completeError}
        onConfirm={handleComplete}
        onClose={() => { if (!completing.current) setCompleteTarget(null); }}
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
