import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import type { OrderResponseDTO, SpringPage, StockResponseDTO } from '../types';
import { formatBRL, formatOrderId, formatShortDateTime, getOrderStatusBadge, getPaymentStatusBadge } from '../utils/format';

const STATUS_OPTIONS = [
  { value: 'PENDING',   label: 'Pendente',    icon: 'pending_actions', color: 'text-yellow-700 hover:bg-yellow-50' },
  { value: 'SHIPPED',   label: 'Em Trânsito', icon: 'local_shipping',  color: 'text-blue-700 hover:bg-blue-50' },
  { value: 'DELIVERED', label: 'Entregue',    icon: 'check_circle',    color: 'text-green-700 hover:bg-green-50' },
  { value: 'CANCELLED', label: 'Cancelado',   icon: 'cancel',          color: 'text-red-600 hover:bg-red-50' },
];

type Period = 'today' | 'week' | 'all';

function formatDeliveryTime(dateStr: string): { label: string; isUrgent: boolean } {
  const d = new Date(dateStr);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 86400000);

  const hhmm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (d >= todayStart && d < tomorrowStart) {
    const diffMin = Math.round((d.getTime() - now.getTime()) / 60000);
    const isUrgent = diffMin <= 60;
    const label = diffMin < 60 ? `em ${diffMin}min` : `às ${hhmm}`;
    return { label, isUrgent };
  }
  if (d >= tomorrowStart && d < new Date(tomorrowStart.getTime() + 86400000)) {
    return { label: `amanhã ${hhmm}`, isUrgent: false };
  }
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return { label: `${dd}/${mm} ${hhmm}`, isUrgent: false };
}

function isWithinPeriod(dateStr: string, period: Period): boolean {
  if (period === 'all') return true;
  const d = new Date(dateStr);
  const now = new Date();
  if (period === 'today') {
    return d.toDateString() === now.toDateString();
  }
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  return d >= weekAgo;
}

export function DashboardPage() {
  const { http } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState<OrderResponseDTO[]>([]);
  const [allTodayOrders, setAllTodayOrders] = useState<OrderResponseDTO[]>([]);
  const [activeOrders, setActiveOrders] = useState<OrderResponseDTO[]>([]);
  const [shippedCount, setShippedCount] = useState(0);
  const [criticalStock, setCriticalStock] = useState(0);
  const [period, setPeriod] = useState<Period>('all');

  const [statusMenu, setStatusMenu] = useState<{ id: string; top: number; left: number } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!statusMenu) return;
    function handleClick() { setStatusMenu(null); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [statusMenu]);

  const fetchData = useCallback(async () => {
    if (!http) return;
    try {
      const [ordersRes, activeRes, shippedRes, stockRes, todayRes] = await Promise.allSettled([
        http.get<SpringPage<OrderResponseDTO>>('/orders', { params: { size: 20, page: 0 } }),
        http.get<OrderResponseDTO[]>('/orders/active'),
        http.get<SpringPage<OrderResponseDTO>>('/orders', { params: { status: 'SHIPPED', size: 1 } }),
        http.get<SpringPage<StockResponseDTO>>('/stock', { params: { size: 200 } }),
        http.get<SpringPage<OrderResponseDTO>>('/orders', { params: { size: 100, page: 0 } }),
      ]);

      if (ordersRes.status === 'fulfilled') setRecentOrders(ordersRes.value.data.content);
      if (activeRes.status === 'fulfilled') setActiveOrders(activeRes.value.data);
      if (shippedRes.status === 'fulfilled') setShippedCount(shippedRes.value.data.totalElements);
      if (stockRes.status === 'fulfilled') {
        const critical = stockRes.value.data.content.filter(
          (s) => s.status.toUpperCase() !== 'NORMAL'
        ).length;
        setCriticalStock(critical);
      }
      if (todayRes.status === 'fulfilled') {
        const todayStr = new Date().toDateString();
        const todayOnly = (todayRes.value.data.content ?? []).filter(
          (o) => new Date(o.createDate).toDateString() === todayStr
        );
        setAllTodayOrders(todayOnly);
      }
    } finally {
      setLoading(false);
    }
  }, [http]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function changeStatus(orderId: string, status: string) {
    if (!http) return;
    setActionLoading(orderId);
    try {
      if (status === 'DELIVERED') {
        await http.patch(`/orders/${orderId}/confirm-delivery`);
      } else if (status === 'CANCELLED') {
        await http.delete(`/orders/${orderId}`);
      } else {
        await http.patch(`/orders/${orderId}/status`, null, { params: { status } });
      }
      fetchData();
    } finally {
      setActionLoading(null);
    }
  }

  const now = new Date();

  const upcomingDeliveries = activeOrders
    .filter((o) => o.deliveryDate && new Date(o.deliveryDate) > now)
    .sort((a, b) => new Date(a.deliveryDate!).getTime() - new Date(b.deliveryDate!).getTime())
    .slice(0, 6);

  const filteredOrders = recentOrders.filter((o) => isWithinPeriod(o.createDate, period));

  const kpis: {
    icon: string; label: string; value: string | number; sub: string;
    iconColor: string; iconBg: string; topColor: string;
    badge?: string; badgeColor?: string;
  }[] = [
    {
      icon: 'local_shipping',
      label: 'Pedidos Ativos',
      value: loading ? '—' : activeOrders.length,
      sub: 'pendentes e em trânsito',
      iconColor: 'text-teal',
      iconBg: 'bg-teal/10',
      topColor: '#0d9488',
      badge: activeOrders.length > 0 ? 'Ativo' : undefined,
      badgeColor: 'bg-teal/10 text-teal',
    },
    {
      icon: 'directions_car',
      label: 'Em Trânsito',
      value: loading ? '—' : shippedCount,
      sub: 'saídas em andamento',
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-50',
      topColor: '#3b82f6',
      badge: shippedCount > 0 ? 'Saindo' : undefined,
      badgeColor: 'bg-blue-100 text-blue-600',
    },
    {
      icon: 'inventory_2',
      label: 'Estoque Crítico',
      value: loading ? '—' : criticalStock,
      sub: 'itens abaixo do mínimo',
      iconColor: criticalStock > 0 ? 'text-orange-500' : 'text-slate-400',
      iconBg: criticalStock > 0 ? 'bg-orange-50' : 'bg-slate-100',
      topColor: criticalStock > 0 ? '#f97316' : '#e2e8f0',
      badge: criticalStock > 0 ? 'Atenção' : undefined,
      badgeColor: 'bg-orange-100 text-orange-600',
    },
    {
      icon: 'schedule_send',
      label: 'Entregas Agendadas',
      value: loading ? '—' : upcomingDeliveries.length,
      sub: 'a partir de agora',
      iconColor: 'text-primary',
      iconBg: 'bg-primary/10',
      topColor: '#0056c6',
      badge: upcomingDeliveries.length > 0 ? 'Agendado' : undefined,
      badgeColor: 'bg-primary/10 text-primary',
    },
  ];

  const today = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  const todayRevenue = allTodayOrders
    .filter(o => o.status !== 'CANCELLED')
    .reduce((s, o) => s + o.totalValue, 0);

  const todayReceived = allTodayOrders
    .filter(o => o.status !== 'CANCELLED' && o.paymentStatus === 'PAID')
    .reduce((s, o) => s + o.totalValue, 0);

  const todayPending = allTodayOrders
    .filter(o => o.status !== 'CANCELLED' && o.paymentStatus !== 'PAID')
    .reduce((s, o) => s + o.totalValue, 0);

  const todayCount = allTodayOrders.filter(o => o.status !== 'CANCELLED').length;

  return (
    <>
      <TopBar />

      <div className="p-6 max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-h1 text-slate-800">Dashboard</h1>
            <p className="text-body-lg text-slate-500 capitalize">{today}</p>
          </div>
          <button
            onClick={() => navigate('/orders')}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white rounded-lg text-[13px] font-bold shadow-md shadow-primary/25 hover:brightness-110 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
            Novo Pedido
          </button>
        </div>

        {/* Saldo do Dia banner */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary via-teal to-teal-light" />
          <div className="px-6 py-4 flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-lg bg-primary/10">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: '22px' }}>account_balance_wallet</span>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Saldo do Dia</p>
                <p className="text-[28px] font-black text-slate-800 leading-none">
                  {loading ? '—' : formatBRL(todayRevenue)}
                </p>
              </div>
            </div>
            <div className="h-10 w-px bg-slate-100 hidden md:block" />
            <div className="text-center">
              <p className="text-[11px] text-slate-500 font-medium">Pedidos</p>
              <p className="text-[20px] font-black text-slate-700">{loading ? '—' : todayCount}</p>
            </div>
            <div className="h-10 w-px bg-slate-100 hidden md:block" />
            <div className="text-center">
              <p className="text-[11px] text-slate-500 font-medium">Recebido</p>
              <p className="text-[20px] font-black text-teal">{loading ? '—' : formatBRL(todayReceived)}</p>
            </div>
            <div className="h-10 w-px bg-slate-100 hidden md:block" />
            <div className="text-center">
              <p className="text-[11px] text-slate-500 font-medium">Em Aberto</p>
              <p className={`text-[20px] font-black ${todayPending > 0 ? 'text-orange-500' : 'text-slate-400'}`}>
                {loading ? '—' : formatBRL(todayPending)}
              </p>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-card hover:shadow-card-hover transition-shadow overflow-hidden relative"
            >
              <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl" style={{ backgroundColor: kpi.topColor }} />
              <div className="flex items-start justify-between mb-3 mt-1">
                <div className={`p-2 rounded-lg ${kpi.iconBg}`}>
                  <span className={`material-symbols-outlined ${kpi.iconColor}`} style={{ fontSize: '22px' }}>{kpi.icon}</span>
                </div>
                {kpi.badge && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${kpi.badgeColor}`}>{kpi.badge}</span>
                )}
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1">{kpi.label}</p>
              <p className="text-[32px] font-black text-slate-800 leading-none">{kpi.value}</p>
              <p className="text-[11px] text-slate-400 mt-1">{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Recent orders */}
          <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-card">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-[15px] font-bold text-slate-800">Pedidos Recentes</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {filteredOrders.length} {filteredOrders.length === 1 ? 'pedido' : 'pedidos'} encontrados
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {(['today', 'week', 'all'] as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                      period === p ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {p === 'today' ? 'Hoje' : p === 'week' ? '7 dias' : 'Todos'}
                  </button>
                ))}
                <div className="w-px h-4 bg-slate-200 mx-1" />
                <button
                  onClick={() => navigate('/orders')}
                  className="text-[12px] font-semibold text-primary hover:underline flex items-center gap-0.5"
                >
                  Ver todos
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-10 text-center flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-[13px] text-slate-400">Carregando...</span>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="p-10 text-center">
                  <span className="material-symbols-outlined block mb-2 text-slate-200" style={{ fontSize: '36px' }}>inbox</span>
                  <p className="text-[13px] text-slate-400">Nenhum pedido neste período.</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">ID</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Entrega</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pagamento</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredOrders.map((order) => {
                      const badge = getOrderStatusBadge(order.status);
                      const payBadge = getPaymentStatusBadge(order.paymentStatus);
                      const isDelivered = order.status === 'DELIVERED';
                      const isCancelled = order.status === 'CANCELLED';
                      const isLoadingThis = actionLoading === order.id;
                      return (
                        <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                          <td
                            className="px-5 py-3 text-[13px] font-mono font-semibold text-primary cursor-pointer hover:underline"
                            onClick={() => navigate(`/orders/${order.id}`)}
                          >
                            {formatOrderId(order.id)}
                          </td>
                          <td className="px-5 py-3 text-[13px] font-medium text-slate-700">{order.clientName}</td>
                          <td className="px-5 py-3 text-[13px] font-bold text-slate-800">{formatBRL(order.totalValue)}</td>
                          <td className="px-5 py-3">
                            <button
                              onClick={(e) => {
                                if (isDelivered || isCancelled || isLoadingThis) return;
                                const rect = e.currentTarget.getBoundingClientRect();
                                setStatusMenu(statusMenu?.id === order.id ? null : { id: order.id, top: rect.bottom + 4, left: rect.left });
                              }}
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${badge.className} ${!isDelivered && !isCancelled && !isLoadingThis ? 'cursor-pointer hover:brightness-95' : 'cursor-default'}`}
                            >
                              {isLoadingThis ? '...' : badge.label}
                              {!isDelivered && !isCancelled && !isLoadingThis && <span className="opacity-50">▾</span>}
                            </button>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${payBadge.className}`}>
                              {payBadge.label}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-[12px] text-slate-400 text-right tabular-nums">
                            {formatShortDateTime(order.createDate)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">

            {/* Próximas Entregas */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-card">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: '18px' }}>schedule_send</span>
                  <h2 className="text-[15px] font-bold text-slate-800">Próximas Entregas</h2>
                </div>
                {upcomingDeliveries.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                    {upcomingDeliveries.length}
                  </span>
                )}
              </div>

              {loading ? (
                <div className="p-6 text-center">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : upcomingDeliveries.length === 0 ? (
                <div className="p-8 text-center">
                  <span className="material-symbols-outlined block mb-2 text-slate-200" style={{ fontSize: '32px' }}>event_available</span>
                  <p className="text-[13px] text-slate-400">Nenhuma entrega agendada.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {upcomingDeliveries.map((order) => {
                    const { label: timeLabel, isUrgent } = formatDeliveryTime(order.deliveryDate!);
                    const itemsSummary = order.items.slice(0, 2).map((i) => `${i.productName} ×${i.quantity}`).join(', ')
                      + (order.items.length > 2 ? ` +${order.items.length - 2}` : '');
                    return (
                      <div
                        key={order.id}
                        onClick={() => navigate(`/orders/${order.id}`)}
                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <div className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap ${
                          isUrgent
                            ? 'bg-red-50 text-red-600 border border-red-200'
                            : 'bg-primary/8 text-primary border border-primary/20'
                        }`}>
                          {timeLabel}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-slate-700 truncate">{order.clientName}</p>
                          <p className="text-[11px] text-slate-400 truncate">{itemsSummary}</p>
                        </div>
                        <span className="material-symbols-outlined text-slate-300 flex-shrink-0" style={{ fontSize: '16px' }}>chevron_right</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Stock alert */}
            <div className={`rounded-xl p-5 shadow-card border ${
              criticalStock > 0
                ? 'bg-orange-50 border-orange-100'
                : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`material-symbols-outlined ${criticalStock > 0 ? 'text-orange-500' : 'text-slate-400'}`} style={{ fontSize: '18px' }}>inventory_2</span>
                <h3 className="text-[13px] font-bold text-slate-700">Alerta de Estoque</h3>
                {criticalStock > 0 && (
                  <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
                    {criticalStock} crítico{criticalStock !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-[12px] text-slate-500 mb-3">
                {criticalStock > 0
                  ? `${criticalStock} item${criticalStock !== 1 ? 's' : ''} abaixo do estoque mínimo.`
                  : 'Todos os itens dentro do estoque normal.'}
              </p>
              <button
                onClick={() => navigate('/stock')}
                className={`w-full py-2 rounded-lg font-bold text-[12px] uppercase tracking-wide transition-colors ${
                  criticalStock > 0
                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Ver Estoque
              </button>
            </div>

            {/* Controle de Caixa */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: '18px' }}>point_of_sale</span>
                <h2 className="text-[15px] font-bold text-slate-800">Controle de Caixa</h2>
                <span className="ml-auto text-[11px] text-slate-400">hoje</span>
              </div>
              <div className="divide-y divide-slate-50">
                {[
                  { label: 'Receita Bruta', value: todayRevenue, color: 'text-slate-800', icon: 'trending_up' },
                  { label: 'Recebido (Quitado)', value: todayReceived, color: 'text-teal', icon: 'check_circle' },
                  { label: 'Pendente / Parcial', value: todayPending, color: todayPending > 0 ? 'text-orange-500' : 'text-slate-400', icon: 'schedule' },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`material-symbols-outlined ${row.color}`} style={{ fontSize: '16px' }}>{row.icon}</span>
                      <span className="text-[13px] text-slate-600">{row.label}</span>
                    </div>
                    <span className={`text-[13px] font-bold tabular-nums ${row.color}`}>
                      {loading ? '—' : formatBRL(row.value)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-5 py-3 bg-slate-50">
                  <span className="text-[12px] font-semibold text-slate-500">Pedidos hoje</span>
                  <span className="text-[13px] font-black text-slate-700">{loading ? '—' : todayCount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status dropdown */}
      {statusMenu && (() => {
        const currentOrder = recentOrders.find((o) => o.id === statusMenu.id);
        return (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: statusMenu.top, left: statusMenu.left, zIndex: 9999 }}
            className="bg-white border border-slate-200 rounded-xl shadow-card-hover min-w-[190px] overflow-hidden"
          >
            <p className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100 bg-slate-50">
              Alterar status
            </p>
            {STATUS_OPTIONS.map((opt) => {
              const isCurrent = currentOrder?.status === opt.value;
              return (
                <button
                  key={opt.value}
                  disabled={isCurrent}
                  onClick={() => { const id = statusMenu.id; setStatusMenu(null); changeStatus(id, opt.value); }}
                  className={`w-full text-left px-4 py-2.5 text-[13px] font-semibold flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-default ${isCurrent ? 'bg-slate-50 text-slate-400' : opt.color}`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{opt.icon}</span>
                  {opt.label}
                  {isCurrent && <span className="ml-auto text-[10px] opacity-50">atual</span>}
                </button>
              );
            })}
          </div>
        );
      })()}
    </>
  );
}
