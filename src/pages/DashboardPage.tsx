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

  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

  return (
    <>
      <TopBar />

      <main className="p-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-h1 text-on-surface">Dashboard Visão Geral</h1>
            <p className="text-body-lg text-on-surface-variant">
              Bem-vindo de volta, {auth?.username ?? 'Admin'}. Aqui está o resumo da operação hoje.
            </p>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-1 px-4 py-2 bg-surface-container-highest border border-outline-variant rounded-lg text-label-sm hover:bg-surface-dim transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>calendar_today</span>
              Hoje: {today}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-surface border border-outline-variant rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
              <div className="p-2 bg-primary-container rounded-lg">
                <span className="material-symbols-outlined text-on-primary-container">local_shipping</span>
              </div>
              <span className="text-label-sm text-primary">Ativos</span>
            </div>
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Pedidos Ativos</p>
            <p className="text-h1 text-on-surface mt-1">{loading ? '—' : activeOrdersCount}</p>
          </div>

          <div className="bg-surface border border-outline-variant rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
              <div className="p-2 bg-secondary-container rounded-lg">
                <span className="material-symbols-outlined text-on-secondary-container">propane_tank</span>
              </div>
              <span className="text-label-sm text-secondary">Atenção</span>
            </div>
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Vasilhames Pendentes</p>
            <p className="text-h1 text-on-surface mt-1">—</p>
          </div>

          <div className="bg-surface border border-outline-variant rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
              <div className="p-2 bg-error-container rounded-lg">
                <span className="material-symbols-outlined text-on-error-container">warning</span>
              </div>
              <span className="text-label-sm text-error">Crítico</span>
            </div>
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Clientes em Atraso</p>
            <p className="text-h1 text-error mt-1">—</p>
          </div>

          <div className="bg-surface border border-outline-variant rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
              <div className="p-2 bg-tertiary-fixed rounded-lg">
                <span className="material-symbols-outlined text-on-tertiary-fixed-variant">inventory</span>
              </div>
              <span className="text-label-sm text-tertiary">Estoque</span>
            </div>
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Estoque Crítico</p>
            <p className="text-h1 text-on-surface mt-1">—</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h3 className="text-h3 text-on-surface">Últimos Pedidos</h3>
              <button
                onClick={() => navigate('/orders')}
                className="text-primary text-label-sm hover:underline"
              >
                Ver Todos
              </button>
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-8 text-center text-on-surface-variant text-body-md">Carregando...</div>
              ) : recentOrders.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant text-body-md">
                  Nenhum pedido encontrado.
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-surface-container-high border-b border-outline-variant">
                    <tr>
                      <th className="px-4 py-3 text-label-sm text-on-surface-variant">ID</th>
                      <th className="px-4 py-3 text-label-sm text-on-surface-variant">CLIENTE</th>
                      <th className="px-4 py-3 text-label-sm text-on-surface-variant">TOTAL</th>
                      <th className="px-4 py-3 text-label-sm text-on-surface-variant">STATUS</th>
                      <th className="px-4 py-3 text-label-sm text-on-surface-variant text-right">HORA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {recentOrders.map((order) => {
                      const badge = getOrderStatusBadge(order.status);
                      const isDelivered = order.status === 'DELIVERED';
                      const isCancelled = order.status === 'CANCELLED';
                      const isLoadingThis = actionLoading === order.id;
                      return (
                        <tr
                          key={order.id}
                          className="hover:bg-surface-container transition-colors"
                        >
                          <td
                            className="px-4 py-3 text-body-md font-semibold text-primary cursor-pointer hover:underline"
                            onClick={() => navigate(`/orders/${order.id}`)}
                          >
                            {formatOrderId(order.id)}
                          </td>
                          <td className="px-4 py-3 text-body-md font-semibold text-on-surface">
                            {order.clientName}
                          </td>
                          <td className="px-4 py-3 text-body-md text-on-surface">
                            {formatBRL(order.totalValue)}
                          </td>
                          <td className="px-4 py-3">
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
                              className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-tight transition-all ${badge.className} ${!isDelivered && !isCancelled && !isLoadingThis ? 'cursor-pointer hover:brightness-95' : 'cursor-default'}`}
                            >
                              {isLoadingThis ? '...' : badge.label}
                              {!isDelivered && !isCancelled && !isLoadingThis && (
                                <span className="ml-1 opacity-50">▾</span>
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-body-md text-on-surface-variant text-right">
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

          <div className="space-y-6">
            <div className="bg-tertiary-fixed border border-tertiary/20 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2 text-on-tertiary-fixed-variant">
                <span className="material-symbols-outlined">inventory_2</span>
                <h3 className="text-label-sm uppercase">Alerta de Estoque</h3>
              </div>
              <p className="text-body-md text-on-tertiary-fixed mb-4">
                Monitore os itens em estoque crítico para garantir a continuidade das operações.
              </p>
              <button
                onClick={() => navigate('/stock')}
                className="w-full bg-tertiary-container text-white py-2 rounded-lg font-bold text-[12px] uppercase hover:brightness-110 transition-all"
              >
                Ver Estoque
              </button>
            </div>

            <div className="bg-surface border border-outline-variant rounded-xl p-4 shadow-sm">
              <h3 className="text-h3 text-on-surface mb-4">Próximas Entregas</h3>
              <div className="text-center py-6 text-on-surface-variant text-body-md">
                <span
                  className="material-symbols-outlined block mb-2 text-outline"
                  style={{ fontSize: '40px' }}
                >
                  local_shipping
                </span>
                Nenhuma entrega agendada.
              </div>
            </div>
          </div>
        </div>
      </main>

      {statusMenu && (() => {
        const currentOrder = recentOrders.find((o) => o.id === statusMenu.id);
        return (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: statusMenu.top, left: statusMenu.left, zIndex: 9999 }}
            className="bg-surface border border-outline-variant rounded-lg shadow-xl min-w-[190px] overflow-hidden"
          >
            <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-outline-variant bg-surface-container-low">
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
                  className={`w-full text-left px-4 py-2.5 text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-default ${isCurrent ? 'bg-surface-container' : opt.color}`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{opt.icon}</span>
                  {opt.label}
                  {isCurrent && <span className="ml-auto text-[10px] font-bold opacity-60">atual</span>}
                </button>
              );
            })}
          </div>
        );
      })()}
    </>
  );
}
