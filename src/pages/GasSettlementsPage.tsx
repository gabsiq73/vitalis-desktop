import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { GasSettlementResponseDTO, GasSupplierResponseDTO, SpringPage } from '../types';
import { formatBRL } from '../utils/format';

type StatusFilter = 'all' | 'pending' | 'settled';

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'Todos',
  pending: 'Pendentes',
  settled: 'Acertados',
};

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
    setLoading(true);
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
      if (settlementsRes.status === 'fulfilled') setSettlements(settlementsRes.value.data ?? []);
      if (suppliersRes.status === 'fulfilled') setSuppliers(suppliersRes.value.data.content ?? []);
    } finally {
      setLoading(false);
    }
  }, [http, startDate, endDate, supplierFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function settleOne(id: string) {
    if (!http) return;
    setSettling(id);
    try {
      await http.patch(`/gas-settlements/${id}/settle`);
      setSettlements(prev =>
        prev.map(s => s.id === id ? { ...s, settled: true, settledDate: new Date().toISOString() } : s)
      );
    } finally {
      setSettling(null);
    }
  }

  async function bulkSettle(supplierId: string) {
    if (!http) return;
    setBulkSettling(supplierId);
    try {
      await http.patch('/gas-settlements/bulk-settle', null, {
        params: { supplierId, start: startDate, end: endDate },
      });
      setSettlements(prev =>
        prev.map(s =>
          s.id && !s.settled && (settlements.find(x => x.id === s.id)?.supplierName === suppliers.find(x => x.id === supplierId)?.name)
            ? { ...s, settled: true, settledDate: new Date().toISOString() }
            : s
        )
      );
      await fetchData();
    } finally {
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

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">

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
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Distribuidora</label>
              <select
                value={supplierFilter}
                onChange={e => setSupplierFilter(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[160px]"
              >
                <option value="">Todas</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-1.5 items-end">
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

        {loading ? (
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
                                onClick={() => bulkSettle(sup.id)}
                                disabled={!!isLoading}
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

            {/* Settlements table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-card">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-700">Detalhamento dos Acertos</h2>
                <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  {filtered.length} registro(s)
                </span>
              </div>

              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <span className="material-symbols-outlined text-slate-300 mb-3" style={{ fontSize: '48px' }}>propane_tank</span>
                  <p className="text-slate-500 font-medium">Nenhum acerto no período</p>
                  <p className="text-slate-400 text-sm mt-1">Ajuste os filtros acima</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs text-slate-500">
                        <th className="text-left px-4 py-3 font-medium">Data</th>
                        <th className="text-left px-4 py-3 font-medium">Distribuidora</th>
                        <th className="text-left px-4 py-3 font-medium">Cliente</th>
                        <th className="text-left px-4 py-3 font-medium">Produto</th>
                        <th className="text-center px-3 py-3 font-medium">Qtd</th>
                        <th className="text-right px-3 py-3 font-medium">Custo Unit.</th>
                        <th className="text-right px-3 py-3 font-medium">Venda Unit.</th>
                        <th className="text-left px-4 py-3 font-medium">Recebimento</th>
                        <th className="text-right px-3 py-3 font-medium">A Pagar</th>
                        <th className="text-right px-3 py-3 font-medium">A Receber</th>
                        <th className="text-center px-4 py-3 font-medium">Status</th>
                        <th className="text-center px-4 py-3 font-medium">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filtered.map(s => {
                        const qty = s.quantity ?? 1;
                        const totalAmount = (s.amount ?? 0) * qty;
                        const isYouOwe = s.settlementType === 'YOU_OWE';
                        const isThisSettling = settling === s.id;
                        return (
                          <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(s.createDate)}</td>
                            <td className="px-4 py-3 font-medium text-slate-700">{s.supplierName}</td>
                            <td className="px-4 py-3 text-slate-600">{s.clientName ?? '—'}</td>
                            <td className="px-4 py-3 text-slate-600">{s.productName ?? '—'}</td>
                            <td className="px-3 py-3 text-center font-semibold text-slate-700">{qty}</td>
                            <td className="px-3 py-3 text-right text-slate-600">{s.costPrice != null ? formatBRL(s.costPrice) : '—'}</td>
                            <td className="px-3 py-3 text-right text-slate-600">{s.salePrice != null ? formatBRL(s.salePrice) : '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                                isYouOwe
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-orange-100 text-orange-700'
                              }`}>
                                <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                                  {isYouOwe ? 'store' : 'local_shipping'}
                                </span>
                                {isYouOwe ? 'Recebido por nós' : 'Entregador recebeu'}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right font-semibold">
                              {isYouOwe
                                ? <span className="text-red-500">{formatBRL(totalAmount)}</span>
                                : <span className="text-slate-300">—</span>
                              }
                            </td>
                            <td className="px-3 py-3 text-right font-semibold">
                              {!isYouOwe
                                ? <span className="text-teal-600">{formatBRL(totalAmount)}</span>
                                : <span className="text-slate-300">—</span>
                              }
                            </td>
                            <td className="px-4 py-3 text-center">
                              {s.settled ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                  <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>check_circle</span>
                                  Acertado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                                  <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>schedule</span>
                                  Pendente
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {!s.settled && (
                                <button
                                  onClick={() => settleOne(s.id)}
                                  disabled={isThisSettling}
                                  title="Marcar como acertado"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 disabled:opacity-40 transition-all"
                                >
                                  {isThisSettling ? (
                                    <span className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin inline-block" />
                                  ) : (
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>task_alt</span>
                                  )}
                                </button>
                              )}
                              {s.settled && s.settledDate && (
                                <span className="text-[11px] text-slate-400">{formatDate(s.settledDate)}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
