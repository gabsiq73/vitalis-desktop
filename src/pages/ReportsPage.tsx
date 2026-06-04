import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { OrderResponseDTO, ClientResponseDTO, StockResponseDTO, SpringPage } from '../types';
import { formatBRL } from '../utils/format';

type Period = '7d' | '30d' | '90d';

const PERIOD_LABELS: Record<Period, string> = {
  '7d': '7 dias',
  '30d': '30 dias',
  '90d': '90 dias',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#eab308',
  SHIPPED: '#3b82f6',
  DELIVERED: '#22c55e',
  CANCELLED: '#ef4444',
};
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  SHIPPED: 'Em Trânsito',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
};


function groupByDay(orders: OrderResponseDTO[], days: number) {
  const now = new Date();
  const buckets: Record<string, { date: string; receita: number; pedidos: number }> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets[key] = { date: key, receita: 0, pedidos: 0 };
  }
  for (const o of orders) {
    const d = new Date(o.createDate);
    const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (buckets[key]) {
      buckets[key].receita += o.totalValue;
      buckets[key].pedidos += 1;
    }
  }
  return Object.values(buckets);
}

function groupByWeek(orders: OrderResponseDTO[]) {
  const buckets: Record<string, { date: string; receita: number; pedidos: number }> = {};
  for (const o of orders) {
    const d = new Date(o.createDate);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = `${String(weekStart.getDate()).padStart(2, '0')}/${String(weekStart.getMonth() + 1).padStart(2, '0')}`;
    if (!buckets[key]) buckets[key] = { date: key, receita: 0, pedidos: 0 };
    buckets[key].receita += o.totalValue;
    buckets[key].pedidos += 1;
  }
  return Object.values(buckets).sort((a, b) => {
    const [da, ma] = a.date.split('/').map(Number);
    const [db, mb] = b.date.split('/').map(Number);
    return ma !== mb ? ma - mb : da - db;
  });
}

export function ReportsPage() {
  const { http } = useAuth();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderResponseDTO[]>([]);
  const [clients, setClients] = useState<ClientResponseDTO[]>([]);
  const [stock, setStock] = useState<StockResponseDTO[]>([]);
  const [period, setPeriod] = useState<Period>('30d');

  const fetchData = useCallback(async () => {
    if (!http) return;
    setLoading(true);
    try {
      const [ordersRes, clientsRes, stockRes] = await Promise.allSettled([
        http.get<SpringPage<OrderResponseDTO>>('/orders', { params: { size: 500, page: 0 } }),
        http.get<SpringPage<ClientResponseDTO>>('/clients', { params: { size: 500, page: 0 } }),
        http.get<SpringPage<StockResponseDTO>>('/stocks', { params: { size: 200, page: 0 } }),
      ]);
      if (ordersRes.status === 'fulfilled') setOrders(ordersRes.value.data.content ?? []);
      if (clientsRes.status === 'fulfilled') setClients(clientsRes.value.data.content ?? []);
      if (stockRes.status === 'fulfilled') setStock(stockRes.value.data.content ?? []);
    } finally {
      setLoading(false);
    }
  }, [http]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const cutoff = new Date(Date.now() - days * 86400000);
  const filteredOrders = orders.filter(o => new Date(o.createDate) >= cutoff);

  // Revenue trend
  const trendData = days <= 30 ? groupByDay(filteredOrders, days) : groupByWeek(filteredOrders);

  // Orders by status
  const statusCount: Record<string, number> = {};
  for (const o of filteredOrders) {
    statusCount[o.status] = (statusCount[o.status] ?? 0) + 1;
  }
  const statusData = Object.entries(statusCount).map(([status, value]) => ({
    name: STATUS_LABELS[status] ?? status,
    value,
    color: STATUS_COLORS[status] ?? '#94a3b8',
  }));

  // Payment status breakdown
  const paidOrders = filteredOrders.filter(o => o.paymentStatus === 'PAID').length;
  const partialOrders = filteredOrders.filter(o => o.paymentStatus === 'PARTIAL').length;
  const pendingPayment = filteredOrders.filter(o => o.paymentStatus === 'PENDING').length;
  const paymentStatusData = [
    { name: 'Pago', value: paidOrders, color: '#22c55e' },
    { name: 'Parcial', value: partialOrders, color: '#eab308' },
    { name: 'Pendente', value: pendingPayment, color: '#f97316' },
  ].filter(d => d.value > 0);

  // Top clients by revenue
  const clientRevenue: Record<string, { name: string; revenue: number; orders: number }> = {};
  for (const o of filteredOrders) {
    if (!clientRevenue[o.clientId]) clientRevenue[o.clientId] = { name: o.clientName, revenue: 0, orders: 0 };
    clientRevenue[o.clientId].revenue += o.totalValue;
    clientRevenue[o.clientId].orders += 1;
  }
  const topClients = Object.values(clientRevenue)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)
    .map(c => ({ ...c, name: c.name.length > 16 ? c.name.slice(0, 16) + '…' : c.name }));

  // Stock health
  const stockHealthData = [
    { name: 'Normal', value: stock.filter(s => s.status?.toUpperCase() === 'NORMAL').length, color: '#22c55e' },
    { name: 'Baixo', value: stock.filter(s => s.status?.toUpperCase() === 'LOW').length, color: '#eab308' },
    { name: 'Crítico', value: stock.filter(s => s.status?.toUpperCase() === 'CRITICAL').length, color: '#f97316' },
    { name: 'Zerado', value: stock.filter(s => s.status?.toUpperCase() === 'OUT_OF_STOCK').length, color: '#ef4444' },
  ].filter(d => d.value > 0);

  // KPIs
  const totalRevenue = filteredOrders.reduce((a, o) => a + o.totalValue, 0);
  const deliveredCount = filteredOrders.filter(o => o.status === 'DELIVERED').length;
  const overdueClients = clients.filter(c => c.clientStatus === 'OVERDUE').length;
  const criticalItems = stock.filter(s => s.status?.toUpperCase() !== 'NORMAL').length;

  const CUSTOM_TOOLTIP_STYLE = {
    borderRadius: '8px',
    border: '1px solid #e2e5ef',
    fontSize: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar title="Relatórios" subtitle="Visão geral do desempenho e estatísticas do negócio" />

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
                { label: 'Receita no Período', value: formatBRL(totalRevenue), icon: 'trending_up', topColor: '#0d9488' },
                { label: 'Pedidos Entregues', value: String(deliveredCount), icon: 'check_circle', topColor: '#0056c6' },
                { label: 'Clientes em Atraso', value: String(overdueClients), icon: 'warning', topColor: overdueClients > 0 ? '#ef4444' : '#6b7280' },
                { label: 'Itens Críticos Estoque', value: String(criticalItems), icon: 'inventory_2', topColor: criticalItems > 0 ? '#f97316' : '#6b7280' },
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

            {/* Revenue trend */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-card p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Evolução da Receita</h2>
              {trendData.every(d => d.receita === 0) ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <span className="material-symbols-outlined mb-2" style={{ fontSize: '40px' }}>show_chart</span>
                  <p className="text-sm">Sem pedidos no período</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={trendData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={CUSTOM_TOOLTIP_STYLE}
                      formatter={(v, name) =>
                        name === 'receita' ? [formatBRL(Number(v ?? 0)), 'Receita'] : [Number(v ?? 0), 'Pedidos']
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} formatter={v => v === 'receita' ? 'Receita' : 'Pedidos'} />
                    <Line type="monotone" dataKey="receita" stroke="#0d9488" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="pedidos" stroke="#0056c6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} strokeDasharray="4 2" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Status + Payment pie charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              <div className="bg-white border border-slate-200 rounded-xl shadow-card p-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-4">Pedidos por Status</h2>
                {statusData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <span className="material-symbols-outlined mb-2" style={{ fontSize: '36px' }}>donut_large</span>
                    <p className="text-sm">Sem dados</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={160} height={160}>
                      <PieChart>
                        <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value" paddingAngle={2}>
                          {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v, _, p) => [v, p.payload.name]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2">
                      {statusData.map(d => (
                        <div key={d.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                            <span className="text-sm text-slate-600">{d.name}</span>
                          </div>
                          <span className="text-sm font-semibold text-slate-700">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl shadow-card p-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-4">Status de Pagamento</h2>
                {paymentStatusData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <span className="material-symbols-outlined mb-2" style={{ fontSize: '36px' }}>payments</span>
                    <p className="text-sm">Sem dados</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={160} height={160}>
                      <PieChart>
                        <Pie data={paymentStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value" paddingAngle={2}>
                          {paymentStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v, _, p) => [v, p.payload.name]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2">
                      {paymentStatusData.map(d => (
                        <div key={d.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                            <span className="text-sm text-slate-600">{d.name}</span>
                          </div>
                          <span className="text-sm font-semibold text-slate-700">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Top clients */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-card p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Top Clientes por Receita</h2>
              {topClients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <span className="material-symbols-outlined mb-2" style={{ fontSize: '36px' }}>group</span>
                  <p className="text-sm">Sem dados no período</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={topClients}
                    layout="vertical"
                    margin={{ top: 4, right: 60, left: 8, bottom: 4 }}
                    barSize={18}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#64748b' }} width={110} />
                    <Tooltip
                      contentStyle={CUSTOM_TOOLTIP_STYLE}
                      formatter={(v) => [formatBRL(Number(v ?? 0)), 'Receita']}
                    />
                    <Bar dataKey="revenue" fill="#0056c6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Stock health */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-xl shadow-card p-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-4">Saúde do Estoque</h2>
                {stockHealthData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <span className="material-symbols-outlined mb-2" style={{ fontSize: '36px' }}>inventory_2</span>
                    <p className="text-sm">Sem dados de estoque</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={160} height={160}>
                      <PieChart>
                        <Pie data={stockHealthData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value" paddingAngle={2}>
                          {stockHealthData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v, _, p) => [v, p.payload.name]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2">
                      {stockHealthData.map(d => (
                        <div key={d.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                            <span className="text-sm text-slate-600">{d.name}</span>
                          </div>
                          <span className="text-sm font-semibold text-slate-700">{d.value} itens</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Summary stats */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-card p-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-4">Resumo Geral</h2>
                <div className="space-y-3">
                  {[
                    { label: 'Total de Pedidos', value: filteredOrders.length, icon: 'shopping_cart' },
                    { label: 'Ticket Médio', value: filteredOrders.length > 0 ? formatBRL(totalRevenue / filteredOrders.length) : '—', icon: 'receipt' },
                    { label: 'Total de Clientes', value: clients.length, icon: 'group' },
                    { label: 'Itens em Estoque', value: stock.reduce((a, s) => a + s.quantityInStock, 0), icon: 'inventory_2' },
                    { label: 'Taxa de Entrega', value: filteredOrders.length > 0 ? `${Math.round((deliveredCount / filteredOrders.length) * 100)}%` : '—', icon: 'local_shipping' },
                  ].map(stat => (
                    <div key={stat.label} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '18px' }}>{stat.icon}</span>
                        <span className="text-sm text-slate-600">{stat.label}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-700">{stat.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
