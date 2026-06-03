import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import type { OrderResponseDTO, SpringPage } from '../types';
import { formatBRL, formatOrderId, formatTime, getOrderStatusBadge } from '../utils/format';

const STATUS_OPTIONS = [
  { value: 'PENDING',   label: 'Pendente',    icon: 'pending_actions', color: 'text-yellow-700 hover:bg-yellow-50' },
  { value: 'SHIPPED',   label: 'Em Trânsito', icon: 'local_shipping',  color: 'text-blue-700 hover:bg-blue-50' },
  { value: 'DELIVERED', label: 'Entregue',    icon: 'check_circle',    color: 'text-green-700 hover:bg-green-50' },
  { value: 'CANCELLED', label: 'Cancelado',   icon: 'cancel',          color: 'text-error hover:bg-error/5' },
];

interface KpiCardProps {
  icon: string;
  label: string;
  value: string | number;
  badge?: string;
  badgeColor?: string;
  iconBg?: string;
  iconColor?: string;
  dark?: boolean;
}

function KpiCard({ icon, label, value, iconBg, iconColor, dark, badge, badgeColor }: KpiCardProps) {
  if (dark) {
    return (
      <div className="bg-on-secondary-fixed rounded-xl p-5 shadow-card flex flex-col justify-between min-h-[110px]">
        <div className="flex items-start justify-between">
          <div className={`p-2 rounded-lg ${iconBg ?? 'bg-white/10'}`}>
            <span className={`material-symbols-outlined ${iconColor ?? 'text-teal'}`} style={{ fontSize: '22px' }}>
              {icon}
            </span>
          </div>
          {badge && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${badgeColor ?? 'bg-teal/20 text-teal'}`}>
              {badge}
            </span>
          )}
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400/60 mb-1">{label}</p>
          <p className="text-[32px] font-black text-white leading-none">{value}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-5 shadow-card hover:shadow-card-hover transition-shadow flex flex-col justify-between min-h-[110px] border border-outline-variant/60">
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${iconBg ?? 'bg-primary/10'}`}>
          <span className={`material-symbols-outlined ${iconColor ?? 'text-primary'}`} style={{ fontSize: '22px' }}>
            {icon}
          </span>
        </div>
        {badge && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${badgeColor ?? 'bg-primary/10 text-primary'}`}>
            {badge}
          </span>
        )}
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
        <p className="text-[32px] font-black text-slate-800 leading-none">{value}</p>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { http, auth } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState<OrderResponseDTO[]>([]);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
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
      const [ordersRes, activeRes] = await Promise.all([
        http.get<SpringPage<OrderResponseDTO>>('/orders', { params: { size: 10, page: 0 } }),
        http.get<OrderResponseDTO[]>('/orders/active'),
      ]);
      setRecentOrders(ordersRes.data.content);
      setActiveOrdersCount(activeRes.data.length);
    } catch {
      setRecentOrders([]);
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

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });

  return (
    <>
      <TopBar />

      <main className="p-6 max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-h1 text-slate-800">Dashboard</h1>
            <p className="text-body-lg text-slate-500">
              Bem-vindo, <span className="font-semibold text-slate-700">{auth?.username ?? 'Admin'}</span>. Resumo da operação de hoje.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-[12px] font-semibold text-slate-500 hover:bg-slate-50 transition-all shadow-sm">
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>calendar_today</span>
              {today}
            </button>
            <button
              onClick={() => navigate('/orders')}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-bold shadow-md shadow-primary/25 hover:brightness-110 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
              Novo Pedido
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon="local_shipping"
            label="Pedidos Ativos"
            value={loading ? '—' : activeOrdersCount}
            badge="Ativo"
            badgeColor="bg-teal/10 text-teal"
            iconBg="bg-teal/10"
            iconColor="text-teal"
          />
          <KpiCard
            icon="propane_tank"
            label="Vasilhames no Campo"
            value="—"
            badge="Atenção"
            badgeColor="bg-yellow-100 text-yellow-700"
            iconBg="bg-yellow-100"
            iconColor="text-yellow-600"
          />
          <KpiCard
            icon="warning"
            label="Clientes em Atraso"
            value="—"
            badge="Crítico"
            badgeColor="bg-red-100 text-red-600"
            iconBg="bg-red-100"
            iconColor="text-red-500"
          />
          <KpiCard
            icon="inventory"
            label="Estoque Crítico"
            value="—"
            dark
            badge="Estoque"
            iconBg="bg-white/10"
            iconColor="text-teal"
          />
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Recent Orders */}
          <div className="lg:col-span-2 bg-white border border-outline-variant/60 rounded-xl overflow-hidden shadow-card">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-[15px] font-bold text-slate-800">Últimos Pedidos</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">10 pedidos mais recentes</p>
              </div>
              <button
                onClick={() => navigate('/orders')}
                className="flex items-center gap-1 text-primary text-[12px] font-semibold hover:underline"
              >
                Ver Todos
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-10 text-center flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-[13px] text-slate-400">Carregando...</span>
                </div>
              ) : recentOrders.length === 0 ? (
                <div className="p-10 text-center">
                  <span className="material-symbols-outlined block mb-2 text-slate-300" style={{ fontSize: '36px' }}>inbox</span>
                  <p className="text-[13px] text-slate-400">Nenhum pedido encontrado.</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">ID</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Cliente</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recentOrders.map((order) => {
                      const badge = getOrderStatusBadge(order.status);
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
                          <td className="px-5 py-3 text-[13px] font-medium text-slate-700">
                            {order.clientName}
                          </td>
                          <td className="px-5 py-3 text-[13px] font-bold text-slate-800">
                            {formatBRL(order.totalValue)}
                          </td>
                          <td className="px-5 py-3">
                            <button
                              onClick={(e) => {
                                if (isDelivered || isCancelled || isLoadingThis) return;
                                const rect = e.currentTarget.getBoundingClientRect();
                                setStatusMenu(
                                  statusMenu?.id === order.id
                                    ? null
                                    : { id: order.id, top: rect.bottom + 4, left: rect.left }
                                );
                              }}
                              className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-tight transition-all ${badge.className} ${!isDelivered && !isCancelled && !isLoadingThis ? 'cursor-pointer hover:brightness-95' : 'cursor-default'}`}
                            >
                              {isLoadingThis ? '...' : badge.label}
                              {!isDelivered && !isCancelled && !isLoadingThis && (
                                <span className="ml-1 opacity-50">▾</span>
                              )}
                            </button>
                          </td>
                          <td className="px-5 py-3 text-[12px] text-slate-400 text-right tabular-nums">
                            {formatTime(order.createDate)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Side widgets */}
          <div className="space-y-4">

            {/* Stock alert */}
            <div className="bg-on-secondary-fixed rounded-xl p-5 shadow-card">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-teal" style={{ fontSize: '18px' }}>inventory_2</span>
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400/60">Alerta de Estoque</h3>
              </div>
              <p className="text-[13px] text-slate-300/80 mb-4 leading-relaxed">
                Monitore itens críticos para garantir a continuidade das entregas.
              </p>
              <button
                onClick={() => navigate('/stock')}
                className="w-full bg-teal text-white py-2 rounded-lg font-bold text-[12px] uppercase tracking-wide hover:bg-teal-dim transition-colors"
              >
                Ver Estoque
              </button>
            </div>

            {/* Upcoming deliveries */}
            <div className="bg-white border border-outline-variant/60 rounded-xl p-5 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[15px] font-bold text-slate-800">Próximas Entregas</h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">Hoje</span>
              </div>
              <div className="py-5 text-center">
                <span className="material-symbols-outlined block mb-2 text-slate-200" style={{ fontSize: '36px' }}>local_shipping</span>
                <p className="text-[13px] text-slate-400">Nenhuma entrega agendada.</p>
              </div>
            </div>

            {/* Quick links */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => navigate('/clients')}
                className="flex flex-col items-center gap-1.5 py-4 bg-white border border-outline-variant/60 rounded-xl hover:border-primary/30 hover:bg-primary/5 transition-all group shadow-sm"
              >
                <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors" style={{ fontSize: '22px' }}>group</span>
                <span className="text-[11px] font-semibold text-slate-400 group-hover:text-primary transition-colors">Clientes</span>
              </button>
              <button
                onClick={() => navigate('/bottles')}
                className="flex flex-col items-center gap-1.5 py-4 bg-white border border-outline-variant/60 rounded-xl hover:border-primary/30 hover:bg-primary/5 transition-all group shadow-sm"
              >
                <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors" style={{ fontSize: '22px' }}>propane_tank</span>
                <span className="text-[11px] font-semibold text-slate-400 group-hover:text-primary transition-colors">Vasilhames</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Status dropdown */}
      {statusMenu && (() => {
        const currentOrder = recentOrders.find((o) => o.id === statusMenu.id);
        return (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: statusMenu.top, left: statusMenu.left, zIndex: 9999 }}
            className="bg-white border border-slate-100 rounded-xl shadow-card-hover min-w-[190px] overflow-hidden"
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
                  onClick={() => {
                    const id = statusMenu.id;
                    setStatusMenu(null);
                    changeStatus(id, opt.value);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-[13px] font-semibold flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-default ${isCurrent ? 'bg-slate-50' : opt.color}`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{opt.icon}</span>
                  {opt.label}
                  {isCurrent && <span className="ml-auto text-[10px] font-bold opacity-50">atual</span>}
                </button>
              );
            })}
          </div>
        );
      })()}
    </>
  );
}
