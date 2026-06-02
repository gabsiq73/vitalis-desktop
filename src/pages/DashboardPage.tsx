import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { OrderResponseDTO, SpringPage } from '../types';

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatOrderId(id: string): string {
  return `#${id.replace(/-/g, '').slice(-6).toUpperCase()}`;
}

function formatTime(dateString: string): string {
  try {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

interface StatusBadgeProps {
  status: string;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status.toUpperCase();
  const colorMap: Record<string, string> = {
    SHIPPED: 'bg-secondary-container text-on-secondary-container',
    DELIVERED: 'bg-primary-container text-on-primary-container',
    OVERDUE: 'bg-error-container text-on-error-container',
    PENDING: 'bg-surface-container-highest text-on-surface-variant',
    CANCELLED: 'bg-surface-container-highest text-on-surface-variant',
    PROCESSING: 'bg-primary-fixed text-on-primary-fixed-variant',
  };
  const className = colorMap[normalized] ?? 'bg-surface-container-highest text-on-surface-variant';

  return (
    <span className={`px-3 py-1 text-[11px] font-bold rounded-full uppercase tracking-tight ${className}`}>
      {status}
    </span>
  );
}

export function DashboardPage() {
  const { http, auth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState<OrderResponseDTO[]>([]);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);

  useEffect(() => {
    if (!http) return;

    const fetchData = async () => {
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
    };

    fetchData();
  }, [http]);

  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

  return (
    <>
      <header className="h-16 flex items-center justify-between px-6 bg-[#0B0C10] border-b border-white/10 sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <span className="text-xl font-black tracking-tighter text-[#1F75FE]">Vitalis</span>
          <div className="relative hidden md:block">
            <span
              className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              style={{ fontSize: '20px' }}
            >
              search
            </span>
            <input
              className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-1.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1F75FE] transition-all w-64"
              placeholder="Search logistics..."
              type="text"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-all">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-all">
            <span className="material-symbols-outlined">settings</span>
          </button>
          <div className="h-8 w-8 rounded-full bg-[#1F75FE] flex items-center justify-center text-white font-bold text-sm ml-1">
            {auth?.username?.charAt(0).toUpperCase() ?? 'U'}
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-h2 text-on-surface">Dashboard Visão Geral</h2>
            <p className="text-body-md text-on-surface-variant">
              Bem-vindo de volta, {auth?.username ?? 'Admin'}. Aqui está o resumo da operação hoje.
            </p>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-1 px-4 py-2 bg-surface-container-highest border border-outline-variant rounded-lg text-label-sm hover:bg-surface-dim transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                calendar_today
              </span>
              Hoje: {today}
            </button>
            <button className="flex items-center gap-1 px-4 py-2 bg-primary text-on-primary rounded-lg text-label-sm hover:brightness-110 shadow-sm transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                download
              </span>
              Exportar PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
              <div className="p-2 bg-primary-container rounded-lg">
                <span className="material-symbols-outlined text-on-primary-container">
                  local_shipping
                </span>
              </div>
              <span className="text-label-sm text-primary">Ativos</span>
            </div>
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">
              Pedidos Ativos
            </p>
            <p className="text-h1 text-on-surface mt-1">{loading ? '—' : activeOrdersCount}</p>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
              <div className="p-2 bg-secondary-container rounded-lg">
                <span className="material-symbols-outlined text-on-secondary-container">
                  propane_tank
                </span>
              </div>
              <span className="text-label-sm text-secondary">Atenção</span>
            </div>
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">
              Vasilhames Pendentes
            </p>
            <p className="text-h1 text-on-surface mt-1">—</p>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
              <div className="p-2 bg-error-container rounded-lg">
                <span className="material-symbols-outlined text-on-error-container">warning</span>
              </div>
              <span className="text-label-sm text-error">Crítico</span>
            </div>
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">
              Clientes em Atraso
            </p>
            <p className="text-h1 text-error mt-1">—</p>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
              <div className="p-2 bg-tertiary-fixed rounded-lg">
                <span className="material-symbols-outlined text-on-tertiary-fixed-variant">
                  inventory
                </span>
              </div>
              <span className="text-label-sm text-tertiary">Estoque</span>
            </div>
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">
              Estoque Crítico
            </p>
            <p className="text-h1 text-on-surface mt-1">—</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h3 className="text-h3 text-on-surface">Últimos Pedidos</h3>
              <button className="text-primary text-label-sm hover:underline">Ver Todos</button>
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-8 text-center text-on-surface-variant text-body-md">
                  Carregando...
                </div>
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
                      <th className="px-4 py-3 text-label-sm text-on-surface-variant text-right">
                        DATA
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {recentOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="hover:bg-surface-container transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-4 text-body-md font-semibold text-primary">
                          {formatOrderId(order.id)}
                        </td>
                        <td className="px-4 py-4 text-body-md font-semibold text-on-surface">
                          {order.clientName}
                        </td>
                        <td className="px-4 py-4 text-body-md text-on-surface">
                          {formatBRL(order.totalValue)}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="px-4 py-4 text-body-md text-on-surface-variant text-right">
                          {formatTime(order.createDate)}
                        </td>
                      </tr>
                    ))}
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
              <button className="w-full bg-tertiary-container text-white py-2 rounded-lg font-bold text-[12px] uppercase hover:brightness-110 transition-all">
                Ver Estoque
              </button>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm">
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
    </>
  );
}
