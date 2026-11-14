import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { FinancialReportDTO, OrderResponseDTO, ClientResponseDTO, StockResponseDTO, SpringPage } from '../types';
import { formatBRL } from '../utils/format';
import { buildOrderReport } from '../utils/orderReport';
import { getStockStatus, isStockLow } from '../utils/stock';
import { parseApiError } from '../utils/parseApiError';

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


export function ReportsPage() {
  const { http } = useAuth();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderResponseDTO[]>([]);
  const [clients, setClients] = useState<ClientResponseDTO[]>([]);
  const [stock, setStock] = useState<StockResponseDTO[]>([]);
  const [period, setPeriod] = useState<Period>('30d');
  const [financial, setFinancial] = useState<FinancialReportDTO | null>(null);
  const [financialError, setFinancialError] = useState('');
  const [financialLoading, setFinancialLoading] = useState(true);
  const [financialRefresh, setFinancialRefresh] = useState(0);

  useEffect(() => {
    if (!http) return;
    let active = true;
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - (period === '7d' ? 6 : period === '30d' ? 29 : 89));
    const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    setFinancialLoading(true);
    setFinancial(null);
    setFinancialError('');
    http.get<FinancialReportDTO>('/reports/performance', { params: { start: localDate(start), end: localDate(end) } })
      .then(response => { if (active) setFinancial(response.data); })
      .catch(err => { if (active) setFinancialError(parseApiError(err)); })
      .finally(() => { if (active) setFinancialLoading(false); });
    return () => { active = false; };
  }, [http, period, financialRefresh]);

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
  const { periodOrders, trendData, totalRevenue, deliveredCount, averageTicket, deliveryRate, topClients } = buildOrderReport(orders, days);

  // Orders by status
  const statusCount: Record<string, number> = {};
  for (const o of periodOrders) {
    statusCount[o.status] = (statusCount[o.status] ?? 0) + 1;
  }
  const statusData = Object.entries(statusCount).map(([status, value]) => ({
    name: STATUS_LABELS[status] ?? status,
    value,
    color: STATUS_COLORS[status] ?? '#94a3b8',
  }));

  // Payment status breakdown
  const paidOrders = periodOrders.filter(o => o.paymentStatus === 'PAID').length;
  const partialOrders = periodOrders.filter(o => o.paymentStatus === 'PARTIAL').length;
  const pendingPayment = periodOrders.filter(o => o.paymentStatus === 'PENDING' && o.status !== 'DELIVERED' && o.status !== 'CANCELLED').length;
  const fiadoPayment = periodOrders.filter(o => o.paymentStatus === 'PENDING' && o.status === 'DELIVERED').length;
  const paymentStatusData = [
    { name: 'Pago', value: paidOrders, color: '#22c55e' },
    { name: 'Parcial', value: partialOrders, color: '#eab308' },
    { name: 'Aguardando', value: pendingPayment, color: '#64748b' },
    { name: 'Fiado', value: fiadoPayment, color: '#f97316' },
  ].filter(d => d.value > 0);

  // Stock health
  const stockHealthData = [
    { name: 'Normal', value: stock.filter(s => getStockStatus(s) === 'NORMAL').length, color: '#22c55e' },
    { name: 'Baixo', value: stock.filter(s => getStockStatus(s) === 'LOW_STOCK').length, color: '#eab308' },
    { name: 'Zerado', value: stock.filter(s => getStockStatus(s) === 'OUT_OF_STOCK').length, color: '#ef4444' },
  ].filter(d => d.value > 0);

  // KPIs
  const overdueClients = clients.filter(c => c.clientStatus === 'OVERDUE').length;
  const criticalItems = stock.filter(isStockLow).length;

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
            onClick={() => { fetchData(); setFinancialRefresh(value => value + 1); }}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>refresh</span>
            Atualizar
          </button>
        </div>

        <section aria-label="Vendas, recebimentos e margem do gás" className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-card">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Vendas, recebimentos e margem do gás</h2>
            <p className="text-xs text-slate-500 mt-1">Vendas e margem consideram a data da entrega. Recebimentos consideram a data do pagamento em PIX/Dinheiro, incluindo crédito novo de clientes. A margem pode estar pendente de repasse; confira Acertos de Gás.</p>
          </div>
          {financialError && <p role="alert" className="text-sm text-error">Não foi possível consultar o financeiro: {financialError}</p>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Vendas entregues (valor bruto)', value: financial?.totalInvoiced },
              { label: 'Recebido no depósito', value: financial?.totalReceived },
              { label: 'Margem do gás entregue', value: financial?.gasGrossProfit },
            ].map(item => <div key={item.label} className="p-4 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500">{item.label}</p>
              <p className="text-xl font-bold text-slate-800 mt-1">{financialLoading ? '—' : item.value === undefined ? 'Indisponível' : formatBRL(item.value)}</p>
            </div>)}
          </div>
        </section>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Valor dos pedidos no período', value: formatBRL(totalRevenue), icon: 'trending_up', topColor: '#0d9488' },
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
              <h2 className="text-sm font-semibold text-slate-700 mb-1">Evolução do valor dos pedidos</h2>
              <p className="text-xs text-slate-500 mb-4">Pela data de criação, incluindo pedidos pendentes e excluindo cancelados. Não representa dinheiro recebido.</p>
              {trendData.every(d => d.receita === 0) ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <span className="material-symbols-outlined mb-2" style={{ fontSize: '40px' }}>show_chart</span>
                  <p className="text-sm">Sem valor de pedidos no período</p>
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
                        name === 'receita' ? [formatBRL(Number(v ?? 0)), 'Valor dos pedidos'] : [Number(v ?? 0), 'Pedidos']
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} formatter={v => v === 'receita' ? 'Valor dos pedidos' : 'Pedidos'} />
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
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Top Clientes por Valor dos Pedidos</h2>
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
                      formatter={(v) => [formatBRL(Number(v ?? 0)), 'Valor dos pedidos']}
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
                <h2 className="text-sm font-semibold text-slate-700 mb-2">Resumo Geral</h2>
                <p className="text-xs text-slate-500 mb-4">Ticket médio e taxa de entrega desconsideram pedidos cancelados.</p>
                <div className="space-y-3">
                  {[
                    { label: 'Total de Pedidos', value: periodOrders.length, icon: 'shopping_cart' },
                    { label: 'Ticket Médio', value: averageTicket === null ? '—' : formatBRL(averageTicket), icon: 'receipt' },
                    { label: 'Total de Clientes', value: clients.length, icon: 'group' },
                    { label: 'Itens em Estoque', value: stock.reduce((a, s) => a + s.quantityInStock, 0), icon: 'inventory_2' },
                    { label: 'Taxa de Entrega', value: deliveryRate === null ? '—' : `${deliveryRate}%`, icon: 'local_shipping' },
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
