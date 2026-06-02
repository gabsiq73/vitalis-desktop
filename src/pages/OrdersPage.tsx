import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import { ConfirmModal } from '../components/ConfirmModal';
import { NewOrderModal } from '../modals/NewOrderModal';
import { AddFidelityPointsModal } from '../modals/AddFidelityPointsModal';
import type { OrderResponseDTO, SpringPage } from '../types';
import {
  formatBRL,
  formatOrderId,
  formatDateTime,
  getInitials,
  getOrderStatusBadge,
  getPaymentStatusBadge,
} from '../utils/format';

const PAGE_SIZE = 20;

const ORDER_STATUSES = [
  { value: '', label: 'Todos os Status' },
  { value: 'PENDING', label: 'Pendente' },
  { value: 'SHIPPED', label: 'Em Trânsito' },
  { value: 'DELIVERED', label: 'Entregue' },
  { value: 'CANCELLED', label: 'Cancelado' },
];

const PAYMENT_STATUSES = [
  { value: '', label: 'Todos os Pagamentos' },
  { value: 'PAID', label: 'Pago' },
  { value: 'PARTIAL', label: 'Parcial' },
  { value: 'PENDING', label: 'Aguardando' },
];

export function OrdersPage() {
  const { http } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderResponseDTO[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');

  const [showNewOrder, setShowNewOrder] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [addPointsTarget, setAddPointsTarget] = useState<{ clientId: string; clientName: string } | null>(null);

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
  }, [http, currentPage, statusFilter, paymentFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleStatusChange(value: string) {
    setStatusFilter(value);
    setCurrentPage(0);
  }

  function handlePaymentChange(value: string) {
    setPaymentFilter(value);
    setCurrentPage(0);
  }

  async function confirmDelivery(orderId: string) {
    if (!http) return;
    setActionLoading(orderId);
    try {
      await http.patch(`/orders/${orderId}/confirm-delivery`);
      fetchOrders();
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

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-3 bg-surface p-6 rounded-xl border border-outline-variant flex flex-col justify-between shadow-sm">
            <span className="text-label-sm text-on-surface-variant uppercase">Total</span>
            <div className="mt-2">
              <span className="text-h1 font-black text-on-surface">
                {loading ? '—' : totalElements.toLocaleString('pt-BR')}
              </span>
            </div>
          </div>

          <div className="md:col-span-9 bg-surface p-6 rounded-xl border border-outline-variant flex items-end gap-6 shadow-sm">
            <div className="flex-1 space-y-1">
              <label className="block text-label-sm text-on-surface-variant">Order Status</label>
              <select
                value={statusFilter}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg text-body-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-1">
              <label className="block text-label-sm text-on-surface-variant">Payment Status</label>
              <select
                value={paymentFilter}
                onChange={(e) => handlePaymentChange(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg text-body-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              >
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <button className="p-2.5 text-on-surface-variant border border-outline-variant rounded-lg hover:bg-surface-container transition-colors">
              <span className="material-symbols-outlined">filter_list</span>
            </button>
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  <th className="px-6 py-4 text-sm font-semibold text-on-surface">ID</th>
                  <th className="px-6 py-4 text-sm font-semibold text-on-surface">Cliente</th>
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
                    <td colSpan={7} className="px-6 py-12 text-center text-on-surface-variant text-body-md">
                      Carregando...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-on-surface-variant text-body-md">
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
                        className="hover:bg-surface-container-low transition-all duration-150"
                        style={{ transition: 'transform 200ms ease-out' }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.transform = 'translateX(4px)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.transform = 'translateX(0)';
                        }}
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
                        <td className="px-6 py-4 text-body-md text-on-surface font-bold">
                          {formatBRL(order.totalValue)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight ${statusBadge.className}`}
                          >
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight ${paymentBadge.className}`}
                          >
                            {paymentBadge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-body-md text-on-surface-variant">
                          {formatDateTime(order.createDate)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              title="Ver detalhes"
                              className="p-1.5 text-on-surface-variant hover:text-primary transition-all"
                            >
                              <span className="material-symbols-outlined">visibility</span>
                            </button>
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
                              onClick={() => confirmDelivery(order.id)}
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
        onSuccess={() => { fetchOrders(); }}
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
    </>
  );
}
