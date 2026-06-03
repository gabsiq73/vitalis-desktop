import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { OrderResponseDTO, OrderItemResponseDTO, GasSupplierResponseDTO, SpringPage } from '../types';
import { formatBRL } from '../utils/format';

interface SupplierSummary {
  id: string;
  name: string;
  totalUnits: number;
  totalCost: number;
  totalRevenue: number;
  margin: number;
  pendingReturn: number;
}

interface ItemWithOrder extends OrderItemResponseDTO {
  orderStatus: string;
  orderDate: string;
}

type Period = '30d' | '90d' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  '30d': '30 dias',
  '90d': '90 dias',
  all: 'Tudo',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function withinPeriod(dateStr: string, period: Period): boolean {
  if (period === 'all') return true;
  const d = new Date(dateStr);
  const days = period === '30d' ? 30 : 90;
  return d >= new Date(Date.now() - days * 86400000);
}

export function GasSettlementsPage() {
  const { http } = useAuth();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderResponseDTO[]>([]);
  const [suppliers, setSuppliers] = useState<GasSupplierResponseDTO[]>([]);
  const [period, setPeriod] = useState<Period>('30d');

  const fetchData = useCallback(async () => {
    if (!http) return;
    setLoading(true);
    try {
      const [ordersRes, suppliersRes] = await Promise.allSettled([
        http.get<SpringPage<OrderResponseDTO>>('/orders', { params: { size: 300, page: 0 } }),
        http.get<GasSupplierResponseDTO[]>('/suppliers'),
      ]);
      if (ordersRes.status === 'fulfilled') setOrders(ordersRes.value.data.content ?? []);
      if (suppliersRes.status === 'fulfilled') setSuppliers(suppliersRes.value.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [http]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const gasItems: ItemWithOrder[] = orders
    .filter(o => withinPeriod(o.createDate, period))
    .flatMap(o =>
      o.items
        .filter(i => i.supplierId)
        .map(i => ({ ...i, orderStatus: o.status, orderDate: o.createDate }))
    );

  const supplierMap = new Map<string, SupplierSummary>();
  for (const item of gasItems) {
    const key = item.supplierId!;
    if (!supplierMap.has(key)) {
      const supplier = suppliers.find(s => s.id === key);
      supplierMap.set(key, {
        id: key,
        name: item.supplierName ?? supplier?.name ?? 'Desconhecido',
        totalUnits: 0,
        totalCost: 0,
        totalRevenue: 0,
        margin: 0,
        pendingReturn: 0,
      });
    }
    const s = supplierMap.get(key)!;
    s.totalUnits += item.quantity;
    s.totalCost += (item.gasCostPrice ?? 0) * item.quantity;
    s.totalRevenue += item.subTotal;
    if (item.receivedByUs === false) s.pendingReturn += item.quantity;
  }
  const supplierSummaries = Array.from(supplierMap.values()).map(s => ({
    ...s,
    margin: s.totalRevenue > 0 ? ((s.totalRevenue - s.totalCost) / s.totalRevenue) * 100 : 0,
  })).sort((a, b) => b.totalUnits - a.totalUnits);

  const chartData = supplierSummaries.map(s => ({
    name: s.name.length > 14 ? s.name.slice(0, 14) + '…' : s.name,
    Custo: parseFloat(s.totalCost.toFixed(2)),
    Receita: parseFloat(s.totalRevenue.toFixed(2)),
  }));

  const totalUnits = supplierSummaries.reduce((a, b) => a + b.totalUnits, 0);
  const totalCost = supplierSummaries.reduce((a, b) => a + b.totalCost, 0);
  const totalRevenue = supplierSummaries.reduce((a, b) => a + b.totalRevenue, 0);
  const totalPending = supplierSummaries.reduce((a, b) => a + b.pendingReturn, 0);

  const pendingItems = gasItems
    .filter(i => i.receivedByUs === false && i.orderStatus !== 'CANCELLED')
    .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
    .slice(0, 20);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar title="Acertos de Gás" subtitle="Controle de vasilhames e acertos com fornecedores" />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">

        {/* Period filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 mr-1">Período:</span>
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                period === p
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
          <button
            onClick={fetchData}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>refresh</span>
            Atualizar
          </button>
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
                  label: 'Vasilhames Movimentados',
                  value: `${totalUnits} un`,
                  icon: 'propane_tank',
                  topColor: '#0056c6',
                },
                {
                  label: 'Custo Total',
                  value: formatBRL(totalCost),
                  icon: 'payments',
                  topColor: '#f97316',
                },
                {
                  label: 'Receita Total',
                  value: formatBRL(totalRevenue),
                  icon: 'trending_up',
                  topColor: '#0d9488',
                },
                {
                  label: 'Pendentes de Acerto',
                  value: `${totalPending} un`,
                  icon: 'pending_actions',
                  topColor: totalPending > 0 ? '#ef4444' : '#6b7280',
                },
              ].map(kpi => (
                <div key={kpi.label} className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden relative">
                  <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: kpi.topColor }} />
                  <div className="p-5 pt-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-slate-500 font-medium mb-1">{kpi.label}</p>
                        <p className="text-2xl font-bold text-slate-800">{kpi.value}</p>
                      </div>
                      <span className="material-symbols-outlined text-slate-300 flex-shrink-0" style={{ fontSize: '28px' }}>
                        {kpi.icon}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Chart + Supplier table */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

              {/* Bar chart */}
              <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl shadow-card p-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-4">Custo vs. Receita por Fornecedor</h2>
                {chartData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <span className="material-symbols-outlined mb-2" style={{ fontSize: '40px' }}>bar_chart</span>
                    <p className="text-sm">Sem dados no período</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData} barSize={24} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(value) => formatBRL(Number(value ?? 0))}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="Custo" fill="#f97316" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Receita" fill="#0d9488" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Supplier summary table */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-card p-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-4">Resumo por Fornecedor</h2>
                {supplierSummaries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <span className="material-symbols-outlined mb-2" style={{ fontSize: '40px' }}>local_shipping</span>
                    <p className="text-sm">Sem movimentações</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {supplierSummaries.map(s => (
                      <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-primary" style={{ fontSize: '16px' }}>propane_tank</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-700 truncate">{s.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{s.totalUnits} un · margem {s.margin.toFixed(1)}%</p>
                          {s.pendingReturn > 0 && (
                            <span className="inline-block mt-1 text-[11px] font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-600">
                              {s.pendingReturn} pendente(s)
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-teal">{formatBRL(s.totalRevenue)}</p>
                          <p className="text-xs text-slate-400">{formatBRL(s.totalCost)} custo</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Pending items */}
            {pendingItems.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-card">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                  <h2 className="text-sm font-semibold text-slate-700">Vasilhames Pendentes de Acerto</h2>
                  <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                    {totalPending} unidades
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs text-slate-500">
                        <th className="text-left px-5 py-3 font-medium">Produto</th>
                        <th className="text-left px-4 py-3 font-medium">Fornecedor</th>
                        <th className="text-center px-4 py-3 font-medium">Qtd</th>
                        <th className="text-left px-4 py-3 font-medium">Data do Pedido</th>
                        <th className="text-left px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pendingItems.map((item, idx) => {
                        const { label, className } = {
                          PENDING: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-700' },
                          SHIPPED: { label: 'Em Trânsito', className: 'bg-blue-100 text-blue-700' },
                          DELIVERED: { label: 'Entregue', className: 'bg-green-100 text-green-700' },
                          CANCELLED: { label: 'Cancelado', className: 'bg-red-100 text-red-600' },
                        }[item.orderStatus as string] ?? { label: item.orderStatus, className: 'bg-slate-100 text-slate-600' };
                        return (
                          <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 font-medium text-slate-700">{item.productName}</td>
                            <td className="px-4 py-3 text-slate-500">{item.supplierName ?? '—'}</td>
                            <td className="px-4 py-3 text-center font-semibold text-slate-700">{item.quantity}</td>
                            <td className="px-4 py-3 text-slate-500">{formatDate(item.orderDate)}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${className}`}>
                                {label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {gasItems.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-card flex flex-col items-center justify-center py-20">
                <span className="material-symbols-outlined text-slate-300 mb-3" style={{ fontSize: '48px' }}>propane_tank</span>
                <p className="text-slate-500 font-medium">Nenhum acerto de gás no período</p>
                <p className="text-slate-400 text-sm mt-1">Tente ampliar o filtro de período</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
