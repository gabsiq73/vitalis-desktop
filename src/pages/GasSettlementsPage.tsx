import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { GasPaymentMethod, GasSettlementResponseDTO, GasSupplierResponseDTO, SpringPage } from '../types';
import { formatBRL } from '../utils/format';
import { Modal } from '../components/Modal';
import { parseApiError } from '../utils/parseApiError';
import { useNotification } from '../hooks/useNotification';
import { EditGasSettlementModal } from '../modals/EditGasSettlementModal';
import { ConfirmModal } from '../components/ConfirmModal';

type StatusFilter = 'all' | 'pending' | 'settled';

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'Todos',
  pending: 'Pendentes',
  settled: 'Acertados',
};

const DETAIL_COLUMNS = [
  { key: 'date', label: 'Data', width: 8, align: 'text-left' },
  { key: 'supplier', label: 'Distribuidora', width: 10, align: 'text-left' },
  { key: 'client', label: 'Cliente', width: 10, align: 'text-left' },
  { key: 'product', label: 'Produto', width: 8, align: 'text-left' },
  { key: 'quantity', label: 'Qtd', width: 4, align: 'text-center' },
  { key: 'cost', label: 'Custo Unit.', width: 7, align: 'text-right' },
  { key: 'sale', label: 'Venda Unit.', width: 7, align: 'text-right' },
  { key: 'received', label: 'Recebimento', width: 10, align: 'text-left' },
  { key: 'toPay', label: 'A Pagar', width: 7, align: 'text-right' },
  { key: 'toReceive', label: 'A Receber', width: 7, align: 'text-right' },
  { key: 'status', label: 'Status', width: 7, align: 'text-center' },
  { key: 'method', label: 'Meio do acerto', width: 6, align: 'text-center' },
  { key: 'actions', label: 'Ação', width: 9, align: 'text-center' },
] as const;

function formatDetailAmount(amount?: number | null): string {
  return amount == null ? '—' : formatBRL(amount).replace('\u00a0', ' ');
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function defaultStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return localDateStr(d);
}

function defaultEnd(): string {
  return localDateStr(new Date());
}

export function GasSettlementsPage() {
  const { http } = useAuth();
  const { notify } = useNotification();
  const [editSettlement, setEditSettlement] = useState<GasSettlementResponseDTO | null>(null);
  const [deleteSettlement, setDeleteSettlement] = useState<GasSettlementResponseDTO | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [target, setTarget] = useState<{ kind: 'single' | 'bulk' | 'legacy'; id: string; label: string; start?: string; end?: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<GasPaymentMethod | ''>('');
  const [actionError, setActionError] = useState('');
  const [loadError, setLoadError] = useState('');
  const submitting = useRef(false);
  const loadRequest = useRef(0);

  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState<string | null>(null);
  const [bulkSettling, setBulkSettling] = useState<string | null>(null);
  const [settlements, setSettlements] = useState<GasSettlementResponseDTO[]>([]);
  const [suppliers, setSuppliers] = useState<GasSupplierResponseDTO[]>([]);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [supplierFilter, setSupplierFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const fetchData = useCallback(async () => {
    if (!http) return;
    const request = ++loadRequest.current;
    setLoading(true);
    setLoadError('');
    try {
      const [settlementsRes, suppliersRes] = await Promise.allSettled([
        http.get<GasSettlementResponseDTO[]>('/gas-settlements', {
          params: {
            start: startDate,
            end: endDate,
            ...(supplierFilter ? { supplierId: supplierFilter } : {}),
          },
        }),
        http.get<SpringPage<GasSupplierResponseDTO>>('/suppliers', { params: { size: 200, page: 0 } }),
      ]);
      if (request !== loadRequest.current) return;
      if (settlementsRes.status === 'fulfilled') setSettlements(settlementsRes.value.data ?? []);
      else { setSettlements([]); setLoadError(parseApiError(settlementsRes.reason)); }
      if (suppliersRes.status === 'fulfilled') setSuppliers(suppliersRes.value.data.content ?? []);
      else { setSuppliers([]); setLoadError(parseApiError(suppliersRes.reason)); }
    } finally {
      if (request === loadRequest.current) setLoading(false);
    }
  }, [http, startDate, endDate, supplierFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openSettlement(next: NonNullable<typeof target>) {
    setPaymentMethod('');
    setActionError('');
    setTarget(next);
  }

  async function confirmDelete() {
    if (!http || !deleteSettlement) return false;
    setDeleteError('');
    try {
      await http.delete(`/gas-settlements/${deleteSettlement.id}`);
      notify(deleteSettlement.orderItemId ? 'Acerto e pedido vinculado apagados.' : 'Acerto apagado.', 'success');
      await fetchData();
      return true;
    } catch (err) { setDeleteError(parseApiError(err)); return false; }
  }

  async function confirmSettlement(event: React.FormEvent) {
    event.preventDefault();
    if (!http || !target || !paymentMethod || submitting.current) return;
    submitting.current = true;
    setActionError('');
    if (target.kind === 'bulk') setBulkSettling(target.id);
    else setSettling(target.id);
    try {
      if (target.kind === 'bulk') {
        await http.patch('/gas-settlements/bulk-settle', null, {
          params: { supplierId: target.id, start: target.start, end: target.end, paymentMethod },
        });
      } else {
        await http.patch(`/gas-settlements/${target.id}/${target.kind === 'legacy' ? 'payment-method' : 'settle'}`, null, { params: { paymentMethod } });
      }
      notify(target.kind === 'legacy' ? 'Meio do acerto registrado.' : 'Acerto registrado.', 'success');
      setTarget(null);
      await fetchData();
    } catch (err) {
      setActionError(parseApiError(err));
    } finally {
      submitting.current = false;
      setSettling(null);
      setBulkSettling(null);
    }
  }

  const filtered = settlements.filter(s => {
    if (statusFilter === 'pending') return !s.settled;
    if (statusFilter === 'settled') return s.settled;
    return true;
  });

  const totalToPay = filtered
    .filter(s => s.settlementType === 'YOU_OWE' && !s.settled)
    .reduce((acc, s) => acc + (s.amount ?? 0) * (s.quantity ?? 1), 0);

  const totalToReceive = filtered
    .filter(s => s.settlementType === 'SUPPLIER_OWE' && !s.settled)
    .reduce((acc, s) => acc + (s.amount ?? 0) * (s.quantity ?? 1), 0);

  const pendingCount = settlements.filter(s => !s.settled).length;
  const netBalance = totalToReceive - totalToPay;

  // Chart: per-supplier A Pagar vs A Receber (unsettled only)
  const supplierChartMap = new Map<string, { name: string; aPagar: number; aReceber: number }>();
  for (const s of settlements.filter(x => !x.settled)) {
    const key = s.supplierName;
    if (!supplierChartMap.has(key)) supplierChartMap.set(key, { name: key, aPagar: 0, aReceber: 0 });
    const entry = supplierChartMap.get(key)!;
    const total = (s.amount ?? 0) * (s.quantity ?? 1);
    if (s.settlementType === 'YOU_OWE') entry.aPagar += total;
    else entry.aReceber += total;
  }
  const chartData = Array.from(supplierChartMap.values()).map(e => ({
    name: e.name.length > 14 ? e.name.slice(0, 14) + '…' : e.name,
    'A Pagar': parseFloat(e.aPagar.toFixed(2)),
    'A Receber': parseFloat(e.aReceber.toFixed(2)),
  }));

  // Unique supplier names in current filtered results (for bulk settle button)
  const supplierNames = [...new Set(filtered.filter(s => !s.settled).map(s => s.supplierName))];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar title="Acertos de Gás" subtitle="Controle financeiro com distribuidoras" />

      <main className="p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
        <ConfirmModal open={deleteSettlement !== null} title="Apagar acerto de gás" danger confirmLabel={deleteSettlement?.orderItemId ? 'Apagar acerto e pedido' : 'Apagar acerto'} error={deleteError}
          message={deleteSettlement?.orderItemId ? `Apagar o acerto de ${deleteSettlement.clientName ?? 'este cliente'} e o pedido vinculado inteiro? Todos os itens, pagamentos, empréstimos e acertos desse pedido serão removidos. Se houver água em crédito nesta promoção, o crédito e os resgates também serão removidos. O estoque será recomposto e o saldo do cliente recalculado. A exclusão não pode ser desfeita.` : 'Apagar este acerto definitivamente? Ele será removido do caixa e dos relatórios. A exclusão não pode ser desfeita.'}
          onConfirm={confirmDelete} onClose={() => setDeleteSettlement(null)} />
        {loadError && <p role="alert" className="p-4 rounded-lg bg-red-50 text-red-700 text-sm">{loadError} Use Atualizar para tentar novamente.</p>}

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-card p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">De</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Até</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 items-end">
              {(Object.keys(STATUS_LABELS) as StatusFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    statusFilter === f
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {STATUS_LABELS[f]}
                </button>
              ))}
            </div>
            <button
              onClick={fetchData}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>refresh</span>
              Atualizar
            </button>
          </div>
        </div>

        {loading && suppliers.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: 'A Pagar (Pendente)',
                  value: formatBRL(totalToPay),
                  icon: 'arrow_upward',
                  topColor: '#ef4444',
                  sub: 'Devemos às distribuidoras',
                },
                {
                  label: 'A Receber (Pendente)',
                  value: formatBRL(totalToReceive),
                  icon: 'arrow_downward',
                  topColor: '#0d9488',
                  sub: 'Distribuidoras nos devem',
                },
                {
                  label: 'Saldo Líquido',
                  value: formatBRL(Math.abs(netBalance)),
                  icon: netBalance >= 0 ? 'trending_up' : 'trending_down',
                  topColor: netBalance >= 0 ? '#0d9488' : '#f97316',
                  sub: netBalance >= 0 ? 'Favorável a nós' : 'Desfavorável',
                },
                {
                  label: 'Acertos Pendentes',
                  value: `${pendingCount}`,
                  icon: 'pending_actions',
                  topColor: pendingCount > 0 ? '#f97316' : '#6b7280',
                  sub: 'No período selecionado',
                },
              ].map(kpi => (
                <div key={kpi.label} className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden relative">
                  <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: kpi.topColor }} />
                  <div className="p-5 pt-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-slate-500 font-medium mb-1">{kpi.label}</p>
                        <p className="text-2xl font-bold text-slate-800">{kpi.value}</p>
                        <p className="text-xs text-slate-400 mt-1">{kpi.sub}</p>
                      </div>
                      <span className="material-symbols-outlined text-slate-300 flex-shrink-0" style={{ fontSize: '28px' }}>
                        {kpi.icon}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Chart + bulk settle */}
            {chartData.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl shadow-card p-5">
                  <h2 className="text-sm font-semibold text-slate-700 mb-4">A Pagar vs. A Receber por Distribuidora (pendentes)</h2>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={chartData} barSize={22} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(v) => formatBRL(Number(v ?? 0))}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="A Pagar" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="A Receber" fill="#0d9488" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-card p-5">
                  <h2 className="text-sm font-semibold text-slate-700 mb-4">Acertar por Distribuidora</h2>
                  {supplierNames.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                      <span className="material-symbols-outlined mb-2" style={{ fontSize: '36px' }}>check_circle</span>
                      <p className="text-sm">Nenhum pendente no período</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {supplierNames.map(name => {
                        const sup = suppliers.find(s => s.name === name);
                        const isLoading = sup && bulkSettling === sup.id;
                        const pendingForSup = settlements.filter(s => !s.settled && s.supplierName === name);
                        const toPay = pendingForSup.filter(s => s.settlementType === 'YOU_OWE').reduce((a, s) => a + (s.amount ?? 0) * (s.quantity ?? 1), 0);
                        const toReceive = pendingForSup.filter(s => s.settlementType === 'SUPPLIER_OWE').reduce((a, s) => a + (s.amount ?? 0) * (s.quantity ?? 1), 0);
                        return (
                          <div key={name} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-700 truncate">{name}</p>
                              <div className="flex gap-3 mt-0.5">
                                {toPay > 0 && <span className="text-xs text-red-500">Pagar {formatBRL(toPay)}</span>}
                                {toReceive > 0 && <span className="text-xs text-teal-600">Receber {formatBRL(toReceive)}</span>}
                              </div>
                            </div>
                            {sup && (
                              <button
                                onClick={() => openSettlement({ kind: 'bulk', id: sup.id, label: `${name}: pagar ${formatBRL(toPay)} e receber ${formatBRL(toReceive)}`, start: startDate, end: endDate })}
                                disabled={loading || !!isLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-all whitespace-nowrap"
                              >
                                {isLoading ? (
                                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>done_all</span>
                                )}
                                Acertar Tudo
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

          </>
        )}

        {/* Settlements table */}
        <section aria-labelledby="gas-settlement-detail" className="rounded-xl border border-slate-200 bg-white shadow-card">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <h2 id="gas-settlement-detail" className="text-sm font-semibold text-slate-700">Detalhamento dos Acertos</h2>
                  {!loading && <span className="text-xs text-slate-500">{filtered.length} registro(s)</span>}
            </div>
            <select
              aria-label="Filtrar por entregador ou fornecedor"
              value={supplierFilter}
              onChange={e => setSupplierFilter(e.target.value)}
              className="w-36 min-w-0 max-w-[52%] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30 sm:w-52"
            >
              <option value="">Todos os entregadores</option>
              {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="flex min-h-24 items-center justify-center" role="status">
              <span aria-hidden="true" className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="sr-only">Carregando acertos</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <span className="material-symbols-outlined text-slate-300 mb-3" style={{ fontSize: '48px' }}>propane_tank</span>
              <p className="text-slate-500 font-medium">Nenhum acerto no período</p>
              <p className="text-slate-400 text-sm mt-1">Ajuste os filtros acima</p>
            </div>
          ) : (
            <div className="[container-type:inline-size]">
              <table role="table" aria-labelledby="gas-settlement-detail" className="block w-full text-xs leading-snug [overflow-wrap:anywhere] [@container(min-width:640px)]:table [@container(min-width:640px)]:table-fixed">
                <thead role="rowgroup" className="hidden bg-slate-50 text-slate-600 [@container(min-width:640px)]:table-header-group">
                  <tr role="row">
                    {DETAIL_COLUMNS.map(column => (
                      <th key={column.key} scope="col" className={`px-1 py-2 font-semibold ${column.align}`} style={{ width: `${column.width}%` }}>
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody role="rowgroup" className="block divide-y divide-slate-100 [@container(min-width:640px)]:table-row-group">
                  {filtered.map(s => {
                    const qty = s.quantity ?? 1;
                    const totalAmount = (s.amount ?? 0) * qty;
                    const isYouOwe = s.settlementType === 'YOU_OWE';
                    const isThisSettling = settling === s.id;
                    const settlementAction = s.settled ? 'Informar meio do acerto antigo' : 'Marcar como acertado';
                    const cells: Record<(typeof DETAIL_COLUMNS)[number]['key'], ReactNode> = {
                      date: <span className="text-[11px] tabular-nums [@container(min-width:850px)]:whitespace-nowrap">{formatDate(s.createDate)}</span>,
                      supplier: <span className="font-medium text-slate-800">{s.supplierName}</span>,
                      client: <span>{s.clientName ?? '—'}</span>,
                      product: <span>{s.productName ?? '—'}</span>,
                      quantity: <span className="font-semibold tabular-nums">{qty}</span>,
                      cost: formatDetailAmount(s.costPrice),
                      sale: formatDetailAmount(s.salePrice),
                      received: (
                        <span className={`inline-flex items-center gap-0.5 rounded-full px-1 py-0.5 text-[11px] font-semibold ${isYouOwe
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-orange-100 text-orange-800'
                        }`}>
                          <span aria-hidden="true" className="material-symbols-outlined size-3 shrink-0 overflow-hidden text-xs">{isYouOwe ? 'store' : 'local_shipping'}</span>
                          <span>{isYouOwe ? 'Recebido por nós' : 'Entregador recebeu'}</span>
                        </span>
                      ),
                      toPay: isYouOwe ? <span className="font-semibold text-red-700">{formatDetailAmount(totalAmount)}</span> : '—',
                      toReceive: isYouOwe ? '—' : <span className="font-semibold text-teal-700">{formatDetailAmount(totalAmount)}</span>,
                      status: (
                        <span className={`inline-flex items-center gap-0.5 rounded-full px-1 py-0.5 text-[11px] font-semibold ${s.settled
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          <span aria-hidden="true" className="hidden shrink-0 [@container(min-width:1000px)]:inline-flex">
                            <span className="material-symbols-outlined size-3 overflow-hidden text-xs">{s.settled ? 'check_circle' : 'schedule'}</span>
                          </span>
                          <span>{s.settled ? 'Acertado' : 'Pendente'}</span>
                        </span>
                      ),
                      method: <span>{s.settled ? s.paymentMethod === 'PIX' ? 'PIX' : s.paymentMethod === 'DINHEIRO' ? 'Dinheiro' : 'Sem meio informado' : '—'}</span>,
                      actions: (
                        <>
                          <div className="flex flex-wrap items-center gap-0.5 [@container(min-width:640px)]:justify-center">
                            <button type="button" aria-label="Editar acerto de gás" title="Editar acerto de gás" onClick={() => setEditSettlement(s)} className="inline-flex size-6 items-center justify-center rounded-md text-primary hover:bg-primary/10">
                              <span aria-hidden="true" className="material-symbols-outlined text-base">edit</span>
                            </button>
                            <button type="button" aria-label="Apagar acerto de gás" title="Apagar acerto de gás" onClick={() => { setDeleteError(''); setDeleteSettlement(s); }} className="inline-flex size-6 items-center justify-center rounded-md text-red-600 hover:bg-red-50">
                              <span aria-hidden="true" className="material-symbols-outlined text-base">delete</span>
                            </button>
                            {(!s.settled || !s.paymentMethod) && (
                              <button
                                type="button"
                                aria-label={settlementAction}
                                title={settlementAction}
                                onClick={() => openSettlement({ kind: s.settled ? 'legacy' : 'single', id: s.id, label: `${s.supplierName}: ${isYouOwe ? 'pagar' : 'receber'} ${formatBRL(totalAmount)}` })}
                                disabled={isThisSettling}
                                className="inline-flex size-6 items-center justify-center rounded-md text-slate-600 hover:bg-green-50 hover:text-green-700 disabled:opacity-40"
                              >
                                {isThisSettling ? (
                                  <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
                                ) : (
                                  <span aria-hidden="true" className="material-symbols-outlined text-base">{s.settled ? 'edit' : 'task_alt'}</span>
                                )}
                              </button>
                            )}
                          </div>
                          {s.settled && s.settledDate && <p className="mt-0.5 text-[11px] tabular-nums text-slate-500 [@container(min-width:850px)]:whitespace-nowrap">{formatDate(s.settledDate)}</p>}
                        </>
                      ),
                    };
                    return (
                      <tr
                        key={s.id}
                        role="row"
                        className="grid grid-cols-2 gap-x-2 px-2 py-1 text-slate-600 hover:bg-slate-50
                          [@container(min-width:400px)]:grid-cols-3 [@container(min-width:640px)]:table-row"
                      >
                        {DETAIL_COLUMNS.map(column => (
                          <td key={column.key} role="cell" className={`min-w-0 px-1 py-1.5 align-middle ${column.align}`}>
                            <span className="block text-[11px] font-medium text-slate-500 [@container(min-width:640px)]:hidden">{column.label}</span>
                            {cells[column.key]}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
      {editSettlement && <EditGasSettlementModal settlement={editSettlement} onClose={() => setEditSettlement(null)} onSuccess={() => { setEditSettlement(null); fetchData(); }} />}
      {target && <Modal open title={target.kind === 'legacy' ? 'Informar meio do acerto' : 'Confirmar acerto de gás'} onClose={() => { if (!submitting.current) setTarget(null); }} maxWidth="max-w-lg">
        <form onSubmit={confirmSettlement} className="p-6 space-y-4 overflow-y-auto">
          <p className="text-sm text-slate-700">{target.label}</p>
          {target.kind === 'bulk' && <p className="text-xs text-slate-500">Todos os pendentes deste fornecedor entre {target.start?.split('-').reverse().join('/')} e {target.end?.split('-').reverse().join('/')} serão acertados no meio selecionado.</p>}
          <p className="text-sm text-slate-500">PIX movimenta o saldo PIX. Dinheiro movimenta o saldo físico do caixa.{target.kind === 'legacy' ? ' A data original do acerto será preservada.' : ''}</p>
          {actionError && <p role="alert" className="text-sm text-red-700 bg-red-50 p-3 rounded-lg">{actionError}</p>}
          <label className="block text-sm font-medium text-slate-700">Meio do acerto
            <select required disabled={!!settling || !!bulkSettling} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as GasPaymentMethod | '')} className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20">
              <option value="">Selecione...</option><option value="PIX">PIX</option><option value="DINHEIRO">Dinheiro</option>
            </select>
          </label>
          <div className="flex justify-end gap-3">
            <button type="button" disabled={!!settling || !!bulkSettling} onClick={() => setTarget(null)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm">Cancelar</button>
            <button type="submit" disabled={!paymentMethod || !!settling || !!bulkSettling} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50">{settling || bulkSettling ? 'Registrando...' : target.kind === 'legacy' ? 'Salvar meio' : 'Confirmar acerto'}</button>
          </div>
        </form>
      </Modal>}
    </div>
  );
}
