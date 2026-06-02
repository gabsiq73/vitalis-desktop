import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import { ConfirmModal } from '../components/ConfirmModal';
import { NewOrderModal } from '../modals/NewOrderModal';
import { AddFidelityPointsModal } from '../modals/AddFidelityPointsModal';
import { AddPaymentModal } from '../modals/AddPaymentModal';
import type { OrderResponseDTO, SpringPage } from '../types';
import {
  formatBRL,
  formatOrderId,
  formatShortDateTime,
  getInitials,
  getOrderStatusBadge,
  getPaymentStatusBadge,
} from '../utils/format';

const PAGE_SIZE = 20;

const ALL_FILTER_CARDS = [
  // status
  { key: 'PENDING',     filterType: 'status',  label: 'Pendente',    icon: 'pending_actions', iconColor: 'text-yellow-600', iconBg: 'bg-yellow-50',  active: 'bg-yellow-50 border-yellow-400 text-yellow-800' },
  { key: 'SHIPPED',     filterType: 'status',  label: 'Em Trânsito', icon: 'local_shipping',  iconColor: 'text-blue-600',   iconBg: 'bg-blue-50',    active: 'bg-blue-50 border-blue-400 text-blue-800' },
  { key: 'DELIVERED',   filterType: 'status',  label: 'Entregue',    icon: 'check_circle',    iconColor: 'text-green-600',  iconBg: 'bg-green-50',   active: 'bg-green-50 border-green-400 text-green-800' },
  { key: 'CANCELLED',   filterType: 'status',  label: 'Cancelado',   icon: 'cancel',          iconColor: 'text-red-500',    iconBg: 'bg-red-50',     active: 'bg-red-50 border-red-400 text-red-800' },
  // payment
  { key: 'PAY_PENDING', filterType: 'payment', label: 'Aguardando',  icon: 'hourglass_empty', iconColor: 'text-orange-500', iconBg: 'bg-orange-50',  active: 'bg-orange-50 border-orange-400 text-orange-800' },
  { key: 'PAY_PARTIAL', filterType: 'payment', label: 'Parcial',     icon: 'payments',        iconColor: 'text-amber-600',  iconBg: 'bg-amber-50',   active: 'bg-amber-50 border-amber-400 text-amber-800' },
  { key: 'PAY_PAID',    filterType: 'payment', label: 'Pago',        icon: 'done_all',        iconColor: 'text-emerald-600',iconBg: 'bg-emerald-50', active: 'bg-emerald-50 border-emerald-400 text-emerald-800' },
];

export function OrdersPage() {
  const { http } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderResponseDTO[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');

  const [counts, setCounts] = useState<Record<string, number>>({});

  const [showNewOrder, setShowNewOrder] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [addPointsTarget, setAddPointsTarget] = useState<{ clientId: string; clientName: string } | null>(null);
  const [statusMenu, setStatusMenu] = useState<{ id: string; top: number; left: number } | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!statusMenu) return;
    function handleClick() { setStatusMenu(null); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [statusMenu]);

  async function fetchCounts() {
    if (!http) return;
    const keys = [
      { key: 'PENDING',   params: { status: 'PENDING',   size: 1 } },
      { key: 'SHIPPED',   params: { status: 'SHIPPED',   size: 1 } },
      { key: 'DELIVERED', params: { status: 'DELIVERED', size: 1 } },
      { key: 'CANCELLED', params: { status: 'CANCELLED', size: 1 } },
      { key: 'PAY_PENDING', params: { paymentStatus: 'PENDING', size: 1 } },
      { key: 'PAY_PARTIAL', params: { paymentStatus: 'PARTIAL', size: 1 } },
      { key: 'PAY_PAID',    params: { paymentStatus: 'PAID',    size: 1 } },
    ];
    const results = await Promise.allSettled(
      keys.map((k) => http.get<SpringPage<OrderResponseDTO>>('/orders', { params: k.params }))
    );
    const next: Record<string, number> = {};
    results.forEach((r, i) => {
      next[keys[i].key] = r.status === 'fulfilled' ? r.value.data.totalElements : 0;
    });
    setCounts(next);
  }

  function fetchOrders() {
    if (!http) return;
    setLoading(true);
    const params: Record<string, string | number> = { page: currentPage, size: PAGE_SIZE };
    if (statusFilter) params.status = statusFilter;
    if (paymentFilter) params.paymentStatus = paymentFilter;

    http
      .get<SpringPage<OrderResponseDTO>>('/orders', { params })
      .then((res) => {
        setOrders(res.data.content);
        setTotalElements(res.data.totalElements);
        setTotalPages(res.data.totalPages);
      })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchOrders();
    fetchCounts();
  }, [http, currentPage, statusFilter, paymentFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleStatusChange(value: string) {
    setStatusFilter(value);
    setCurrentPage(0);
  }

  function handlePaymentChange(value: string) {
    setPaymentFilter(value);
    setCurrentPage(0);
  }

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
      fetchOrders();
      fetchCounts();
    } finally {
      setActionLoading(null);
    }
  }

  async function cancelOrder() {
    if (!http || !cancelTarget) return;
    await http.delete(`/orders/${cancelTarget}`);
    fetchOrders();
  }

  return (
    <>
      <TopBar />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-h1 text-on-surface">Lista de Pedidos</h1>
            <p className="text-body-lg text-on-surface-variant">
              Gerencie e monitore todos os pedidos do sistema em tempo real.
            </p>
          </div>
          <button
            onClick={() => setShowNewOrder(true)}
            className="flex items-center gap-2 bg-primary text-on-primary px-6 py-2.5 rounded-lg font-bold text-h3 hover:brightness-110 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined">add</span>
            Novo Pedido
          </button>
        </div>

        {/* Filtros em linha única */}
        <div className="grid grid-cols-7 gap-2">
          {ALL_FILTER_CARDS.map((card) => {
            const isStatus = card.filterType === 'status';
            const paymentKey = card.key.replace('PAY_', '');
            const isActive = isStatus ? statusFilter === card.key : paymentFilter === paymentKey;
            const count = counts[card.key] ?? (loading ? '…' : '0');

            function toggle() {
              if (isStatus) handleStatusChange(isActive ? '' : card.key);
              else handlePaymentChange(isActive ? '' : paymentKey);
            }

            return (
              <button
                key={card.key}
                onClick={toggle}
                className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all hover:shadow-md ${
                  isActive
                    ? card.active + ' shadow-sm ring-1 ring-inset ring-current/20'
                    : `bg-surface border-outline-variant hover:border-outline`
                }`}
              >
                <div className={`p-1.5 rounded-lg ${isActive ? 'bg-white/60' : card.iconBg}`}>
                  <span className={`material-symbols-outlined ${isActive ? '' : card.iconColor}`} style={{ fontSize: '18px' }}>
                    {card.icon}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant leading-none mb-1">
                    {card.label}
                  </p>
                  <p className="text-h2 font-black text-on-surface leading-none">{count}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  <th className="px-6 py-4 text-sm font-semibold text-on-surface">ID</th>
                  <th className="px-6 py-4 text-sm font-semibold text-on-surface">Cliente</th>
                  <th className="px-6 py-4 text-sm font-semibold text-on-surface">Itens</th>
                  <th className="px-6 py-4 text-sm font-semibold text-on-surface">Total</th>
                  <th className="px-6 py-4 text-sm font-semibold text-on-surface">Status</th>
                  <th className="px-6 py-4 text-sm font-semibold text-on-surface">Pagamento</th>
                  <th className="px-6 py-4 text-sm font-semibold text-on-surface">Criação</th>
                  <th className="px-6 py-4 text-sm font-semibold text-on-surface text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-on-surface-variant text-body-md">
                      Carregando...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-on-surface-variant text-body-md">
                      Nenhum pedido encontrado.
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const statusBadge = getOrderStatusBadge(order.status);
                    const paymentBadge = getPaymentStatusBadge(order.paymentStatus);
                    const isDelivered = order.status === 'DELIVERED';
                    const isCancelled = order.status === 'CANCELLED';
                    const isLoadingThis = actionLoading === order.id;
                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-surface-container-low transition-colors"
                      >
                        <td className="px-6 py-4 text-body-md text-on-surface font-semibold">
                          {formatOrderId(order.id)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-xs flex-shrink-0">
                              {getInitials(order.clientName)}
                            </div>
                            <span className="text-body-md text-on-surface">{order.clientName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex flex-col gap-0.5">
                            {order.items.slice(0, 3).map((item) => (
                              <span key={item.id} className="text-[11px] text-on-surface-variant leading-tight">
                                {item.productName} <span className="font-bold text-on-surface">×{item.quantity}</span>
                              </span>
                            ))}
                            {order.items.length > 3 && (
                              <span className="text-[10px] text-outline">+{order.items.length - 3} mais</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-body-md text-on-surface font-bold">
                          {formatBRL(order.totalValue)}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={(e) => {
                              if (isDelivered || isCancelled) return;
                              const rect = e.currentTarget.getBoundingClientRect();
                              if (statusMenu?.id === order.id) {
                                setStatusMenu(null);
                              } else {
                                setStatusMenu({ id: order.id, top: rect.bottom + 4, left: rect.left });
                              }
                            }}
                            title={isDelivered || isCancelled ? undefined : 'Clique para alterar status'}
                            className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight transition-all ${statusBadge.className} ${!isDelivered && !isCancelled ? 'cursor-pointer hover:brightness-95' : 'cursor-default'}`}
                          >
                            {statusBadge.label}
                            {!isDelivered && !isCancelled && <span className="ml-1 opacity-60">▾</span>}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight ${paymentBadge.className}`}
                          >
                            {paymentBadge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-body-md text-on-surface-variant">
                          {formatShortDateTime(order.createDate)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              title="Ver detalhes"
                              onClick={() => navigate(`/orders/${order.id}`)}
                              className="p-1.5 text-on-surface-variant hover:text-primary transition-all"
                            >
                              <span className="material-symbols-outlined">visibility</span>
                            </button>
                            {order.paymentStatus !== 'PAID' && !isCancelled && (
                              <button
                                title="Registrar pagamento"
                                onClick={() => setPaymentTarget(order.id)}
                                className="p-1.5 text-on-surface-variant hover:text-green-600 transition-all"
                              >
                                <span className="material-symbols-outlined">payments</span>
                              </button>
                            )}
                            <button
                              title="Adicionar pontos de fidelidade"
                              onClick={() =>
                                setAddPointsTarget({
                                  clientId: order.clientId,
                                  clientName: order.clientName,
                                })
                              }
                              className="p-1.5 text-on-surface-variant hover:text-tertiary transition-all"
                            >
                              <span className="material-symbols-outlined">workspace_premium</span>
                            </button>
                            <button
                              title="Confirmar entrega"
                              disabled={isDelivered || isCancelled || isLoadingThis}
                              onClick={() => changeStatus(order.id, 'DELIVERED')}
                              className="p-1.5 text-on-surface-variant hover:text-green-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <span className="material-symbols-outlined">
                                {isLoadingThis ? 'hourglass_empty' : 'check_circle'}
                              </span>
                            </button>
                            <button
                              title="Cancelar pedido"
                              disabled={isDelivered || isCancelled || isLoadingThis}
                              onClick={() => setCancelTarget(order.id)}
                              className="p-1.5 text-on-surface-variant hover:text-error transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <span className="material-symbols-outlined">cancel</span>
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

          <div className="px-6 py-4 bg-surface-container-low border-t border-outline-variant flex justify-between items-center">
            <span className="text-body-md text-on-surface-variant">
              Exibindo{' '}
              <span className="font-semibold text-on-surface">
                {Math.min(currentPage * PAGE_SIZE + 1, Math.max(totalElements, 1))}–
                {Math.min((currentPage + 1) * PAGE_SIZE, totalElements)}
              </span>{' '}
              de <span className="font-semibold text-on-surface">{totalElements}</span> resultados
            </span>
            <div className="flex gap-1">
              <button
                disabled={currentPage === 0}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="p-1.5 border border-outline-variant rounded-lg hover:bg-surface transition-colors disabled:opacity-30"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const start = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
                return start + i;
              }).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-1 rounded-lg text-body-md transition-colors ${
                    pageNum === currentPage ? 'bg-primary text-on-primary' : 'hover:bg-surface'
                  }`}
                >
                  {pageNum + 1}
                </button>
              ))}
              <button
                disabled={currentPage >= totalPages - 1}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="p-1.5 border border-outline-variant rounded-lg hover:bg-surface transition-colors disabled:opacity-30"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <NewOrderModal
        open={showNewOrder}
        onClose={() => setShowNewOrder(false)}
        onSuccess={() => { fetchOrders(); fetchCounts(); }}
      />

      <ConfirmModal
        open={cancelTarget !== null}
        title="Cancelar Pedido"
        message="Tem certeza que deseja cancelar este pedido? Esta ação não pode ser desfeita."
        confirmLabel="Cancelar Pedido"
        danger
        onConfirm={cancelOrder}
        onClose={() => setCancelTarget(null)}
      />

      {addPointsTarget && (
        <AddFidelityPointsModal
          open={addPointsTarget !== null}
          onClose={() => setAddPointsTarget(null)}
          onSuccess={() => setAddPointsTarget(null)}
          clientId={addPointsTarget.clientId}
          clientName={addPointsTarget.clientName}
        />
      )}

      {paymentTarget && (
        <AddPaymentModal
          open={paymentTarget !== null}
          orderId={paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onSuccess={() => { setPaymentTarget(null); fetchOrders(); fetchCounts(); }}
        />
      )}

      {statusMenu && (() => {
        const currentOrder = orders.find((o) => o.id === statusMenu.id);
        const STATUS_OPTIONS = [
          { value: 'PENDING',   label: 'Pendente',     icon: 'pending_actions',  color: 'text-yellow-700 hover:bg-yellow-50' },
          { value: 'SHIPPED',   label: 'Em Trânsito',  icon: 'local_shipping',   color: 'text-blue-700 hover:bg-blue-50' },
          { value: 'DELIVERED', label: 'Entregue',     icon: 'check_circle',     color: 'text-green-700 hover:bg-green-50' },
          { value: 'CANCELLED', label: 'Cancelado',    icon: 'cancel',           color: 'text-error hover:bg-error/5' },
        ];
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
                  {isCurrent && <span className="ml-auto text-[10px] font-bold uppercase opacity-60">atual</span>}
                </button>
              );
            })}
          </div>
        );
      })()}
    </>
  );
}
