import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../contexts/NotificationContext';
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

const STATUS_CHIPS = [
  {
    key: '',
    label: 'Todos',
    icon: 'list',
    inactive: 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50',
    active:   'bg-slate-800 border-slate-800 text-white',
    dot:      'bg-slate-500',
  },
  {
    key: 'PENDING',
    label: 'Pendente',
    icon: 'pending_actions',
    inactive: 'bg-white border-slate-200 text-slate-600 hover:border-yellow-300 hover:bg-yellow-50',
    active:   'bg-yellow-50 border-yellow-400 text-yellow-800',
    dot:      'bg-yellow-400',
  },
  {
    key: 'SHIPPED',
    label: 'Em Trânsito',
    icon: 'local_shipping',
    inactive: 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50',
    active:   'bg-blue-50 border-blue-400 text-blue-800',
    dot:      'bg-blue-400',
  },
  {
    key: 'DELIVERED',
    label: 'Entregue',
    icon: 'check_circle',
    inactive: 'bg-white border-slate-200 text-slate-600 hover:border-green-300 hover:bg-green-50',
    active:   'bg-green-50 border-green-400 text-green-800',
    dot:      'bg-green-400',
  },
  {
    key: 'CANCELLED',
    label: 'Cancelado',
    icon: 'cancel',
    inactive: 'bg-white border-slate-200 text-slate-600 hover:border-red-300 hover:bg-red-50',
    active:   'bg-red-50 border-red-400 text-red-800',
    dot:      'bg-red-400',
  },
];

const STATUS_CHANGE_OPTIONS = [
  { value: 'PENDING',   label: 'Pendente',    icon: 'pending_actions', color: 'text-yellow-700 hover:bg-yellow-50' },
  { value: 'SHIPPED',   label: 'Em Trânsito', icon: 'local_shipping',  color: 'text-blue-700 hover:bg-blue-50' },
  { value: 'DELIVERED', label: 'Entregue',    icon: 'check_circle',    color: 'text-green-700 hover:bg-green-50' },
  { value: 'CANCELLED', label: 'Cancelado',   icon: 'cancel',          color: 'text-red-600 hover:bg-red-50' },
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function OrdersPage() {
  const { http } = useAuth();
  const navigate = useNavigate();
  const { notify } = useNotification();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderResponseDTO[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [dateStart, setDateStart] = useState(todayStr());
  const [dateEnd, setDateEnd] = useState(todayStr());
  const [dateMode, setDateMode] = useState<'today' | 'custom' | 'all'>('today');
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

  function getDateParams() {
    if (dateMode === 'today') return { start: todayStr(), end: todayStr() };
    if (dateMode === 'custom') return { start: dateStart, end: dateEnd };
    return {};
  }

  async function fetchCounts() {
    if (!http) return;
    const dateParams = getDateParams();
    const keys = [
      { key: 'PENDING',     params: { status: 'PENDING',        size: 1, ...dateParams } },
      { key: 'SHIPPED',     params: { status: 'SHIPPED',        size: 1, ...dateParams } },
      { key: 'DELIVERED',   params: { status: 'DELIVERED',      size: 1, ...dateParams } },
      { key: 'CANCELLED',   params: { status: 'CANCELLED',      size: 1, ...dateParams } },
      { key: 'PAY_PENDING', params: { paymentStatus: 'PENDING', size: 1, ...dateParams } },
      { key: 'PAY_PARTIAL', params: { paymentStatus: 'PARTIAL', size: 1, ...dateParams } },
      { key: 'PAY_PAID',    params: { paymentStatus: 'PAID',    size: 1, ...dateParams } },
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
    const dp = getDateParams();
    if (dp.start) params.start = dp.start;
    if (dp.end)   params.end   = dp.end;
    http.get<SpringPage<OrderResponseDTO>>('/orders', { params })
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
  }, [http, currentPage, statusFilter, paymentFilter, dateMode, dateStart, dateEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleStatusChip(key: string) {
    setStatusFilter(key);
    setCurrentPage(0);
  }

  function clearFilters() {
    setStatusFilter('');
    setPaymentFilter('');
    setDateMode('today');
    setCurrentPage(0);
  }

  async function changeStatus(orderId: string, status: string) {
    if (!http) return;
    setActionLoading(orderId);
    try {
      if (status === 'DELIVERED') {
        await http.patch(`/orders/${orderId}/confirm-delivery`);
        notify('Entrega confirmada com sucesso.', 'success');
      } else if (status === 'CANCELLED') {
        await http.delete(`/orders/${orderId}`);
        notify('Pedido cancelado.', 'warning');
      } else {
        await http.patch(`/orders/${orderId}/status`, null, { params: { status } });
        notify('Status do pedido atualizado.', 'info');
      }
      fetchOrders();
      fetchCounts();
    } finally {
      setActionLoading(null);
    }
  }

  const hasActiveFilters = !!(statusFilter || paymentFilter || dateMode !== 'today');
  const totalActive = (counts['PENDING'] ?? 0) + (counts['SHIPPED'] ?? 0);

  return (
    <>
      <TopBar />

      <div className="p-6 max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-h1 text-slate-800">Pedidos</h1>
            <p className="text-body-lg text-slate-500">
              {totalActive > 0
                ? <><span className="font-semibold text-slate-700">{totalActive}</span> pedidos ativos no momento</>
                : 'Gerencie todos os pedidos do sistema.'}
            </p>
          </div>
          <button
            onClick={() => setShowNewOrder(true)}
            className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-bold text-[13px] shadow-md shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            Novo Pedido
          </button>
        </div>

        {/* Date filter */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setDateMode('today'); setCurrentPage(0); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold text-[13px] transition-all shadow-sm ${
              dateMode === 'today'
                ? 'bg-primary text-white border-primary shadow-primary/20'
                : 'bg-white border-slate-200 text-slate-600 hover:border-primary/40 hover:bg-primary/4'
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>today</span>
            Hoje
          </button>

          <button
            onClick={() => { setDateMode('all'); setCurrentPage(0); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold text-[13px] transition-all shadow-sm ${
              dateMode === 'all'
                ? 'bg-slate-700 text-white border-slate-700'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>calendar_view_month</span>
            Todos
          </button>

          <button
            onClick={() => { setDateMode('custom'); setCurrentPage(0); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold text-[13px] transition-all shadow-sm ${
              dateMode === 'custom'
                ? 'bg-white border-primary text-primary'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>date_range</span>
            Período
          </button>

          {dateMode === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateStart}
                onChange={e => { setDateStart(e.target.value); setCurrentPage(0); }}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <span className="text-slate-400 text-sm">até</span>
              <input
                type="date"
                value={dateEnd}
                onChange={e => { setDateEnd(e.target.value); setCurrentPage(0); }}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          )}

          {dateMode === 'today' && (
            <span className="text-[12px] text-slate-400 font-medium">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </span>
          )}
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          {STATUS_CHIPS.map((chip) => {
            const isActive = statusFilter === chip.key;
            const count = chip.key ? (counts[chip.key] ?? 0) : undefined;
            return (
              <button
                key={chip.key || 'all'}
                onClick={() => handleStatusChip(chip.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold text-[13px] transition-all shadow-sm ${
                  isActive ? chip.active : chip.inactive
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{chip.icon}</span>
                {chip.label}
                {count !== undefined && (
                  <span className={`min-w-[20px] h-5 px-1 rounded-full text-[11px] font-black flex items-center justify-center ${
                    isActive ? 'bg-white/60' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {loading ? '—' : count}
                  </span>
                )}
              </button>
            );
          })}

          <div className="h-6 w-px bg-slate-200" />

          <select
            value={paymentFilter}
            onChange={(e) => { setPaymentFilter(e.target.value); setCurrentPage(0); }}
            className={`px-3 py-2 rounded-lg border text-[13px] font-medium transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer ${
              paymentFilter
                ? 'bg-primary/8 border-primary/40 text-primary'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <option value="">Pagamento: Todos</option>
            <option value="PENDING">Aguardando pagamento</option>
            <option value="PARTIAL">Pagamento parcial</option>
            <option value="PAID">Pago</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-[12px] font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>close</span>
              Limpar
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">ID</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Itens</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Entrega</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pagamento</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Criado</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-[13px] text-slate-400">Carregando...</span>
                      </div>
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center">
                      <span className="material-symbols-outlined block mb-2 text-slate-200" style={{ fontSize: '36px' }}>inbox</span>
                      <p className="text-[13px] text-slate-400">Nenhum pedido encontrado.</p>
                      {hasActiveFilters && (
                        <button onClick={clearFilters} className="mt-2 text-[12px] text-primary hover:underline">
                          Limpar filtros
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const statusBadge = getOrderStatusBadge(order.status, order.deliveryDate);
                    const paymentBadge = getPaymentStatusBadge(order.paymentStatus);
                    const isDelivered = order.status === 'DELIVERED';
                    const isCancelled = order.status === 'CANCELLED';
                    const isLoadingThis = actionLoading === order.id;

                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                        onClick={() => navigate(`/orders/${order.id}`)}
                      >
                        <td className="px-5 py-3.5 font-mono font-semibold text-[13px] text-primary">
                          {formatOrderId(order.id)}
                        </td>

                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[11px] flex-shrink-0">
                              {getInitials(order.clientName)}
                            </div>
                            <span className="text-[13px] font-medium text-slate-700">{order.clientName}</span>
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          <div className="flex flex-col gap-0.5">
                            {order.items.slice(0, 2).map((item) => (
                              <span key={item.id} className="text-[11px] text-slate-500 leading-tight">
                                {item.productName} <span className="font-bold text-slate-700">×{item.quantity}</span>
                              </span>
                            ))}
                            {order.items.length > 2 && (
                              <span className="text-[10px] text-slate-400">+{order.items.length - 2} mais</span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-3.5 text-[13px] font-bold text-slate-800 whitespace-nowrap">
                          {formatBRL(order.totalValue)}
                        </td>

                        <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              if (isDelivered || isCancelled) return;
                              const rect = e.currentTarget.getBoundingClientRect();
                              setStatusMenu(statusMenu?.id === order.id ? null : { id: order.id, top: rect.bottom + 4, left: rect.left });
                            }}
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${statusBadge.className} ${!isDelivered && !isCancelled ? 'cursor-pointer hover:brightness-95' : 'cursor-default'}`}
                          >
                            {isLoadingThis ? '...' : statusBadge.label}
                            {!isDelivered && !isCancelled && !isLoadingThis && <span className="opacity-50">▾</span>}
                          </button>
                        </td>

                        <td className="px-5 py-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${paymentBadge.className}`}>
                            {paymentBadge.label}
                          </span>
                        </td>

                        <td className="px-5 py-3.5 text-[12px] text-slate-400 whitespace-nowrap tabular-nums">
                          {formatShortDateTime(order.createDate)}
                        </td>

                        <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end gap-0.5">
                            <button
                              title="Ver detalhes"
                              onClick={() => navigate(`/orders/${order.id}`)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/8 transition-all"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>visibility</span>
                            </button>
                            {order.paymentStatus !== 'PAID' && !isCancelled && (
                              <button
                                title="Registrar pagamento"
                                onClick={() => setPaymentTarget(order.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-all"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>payments</span>
                              </button>
                            )}
                            <button
                              title="Pontos de fidelidade"
                              onClick={() => setAddPointsTarget({ clientId: order.clientId, clientName: order.clientName })}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-all"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>workspace_premium</span>
                            </button>
                            {!isDelivered && !isCancelled && (
                              <button
                                title="Confirmar entrega"
                                disabled={isLoadingThis}
                                onClick={() => changeStatus(order.id, 'DELIVERED')}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-all disabled:opacity-25 disabled:cursor-not-allowed"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>task_alt</span>
                              </button>
                            )}
                            <button
                              title="Cancelar pedido"
                              disabled={isDelivered || isCancelled || isLoadingThis}
                              onClick={() => setCancelTarget(order.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-25 disabled:cursor-not-allowed"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>cancel</span>
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

          {/* Pagination */}
          {totalElements > 0 && (
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <span className="text-[12px] text-slate-500">
                {Math.min(currentPage * PAGE_SIZE + 1, totalElements)}–{Math.min((currentPage + 1) * PAGE_SIZE, totalElements)}
                {' '}<span className="text-slate-400">de</span>{' '}
                <span className="font-semibold text-slate-700">{totalElements}</span> pedidos
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const start = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
                  return start + i;
                }).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-[13px] font-semibold transition-colors ${
                      pageNum === currentPage
                        ? 'bg-primary text-white'
                        : 'text-slate-500 hover:bg-white border border-transparent hover:border-slate-200'
                    }`}
                  >
                    {pageNum + 1}
                  </button>
                ))}
                <button
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
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
        onConfirm={() => changeStatus(cancelTarget!, 'CANCELLED')}
        onClose={() => setCancelTarget(null)}
      />

      {addPointsTarget && (
        <AddFidelityPointsModal
          open
          onClose={() => setAddPointsTarget(null)}
          onSuccess={() => setAddPointsTarget(null)}
          clientId={addPointsTarget.clientId}
          clientName={addPointsTarget.clientName}
        />
      )}

      {paymentTarget && (
        <AddPaymentModal
          open
          orderId={paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onSuccess={() => { setPaymentTarget(null); fetchOrders(); fetchCounts(); }}
        />
      )}

      {statusMenu && (() => {
        const currentOrder = orders.find((o) => o.id === statusMenu.id);
        return (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: statusMenu.top, left: statusMenu.left, zIndex: 9999 }}
            className="bg-white border border-slate-200 rounded-xl shadow-card-hover min-w-[190px] overflow-hidden"
          >
            <p className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100 bg-slate-50">
              Alterar status
            </p>
            {STATUS_CHANGE_OPTIONS.map((opt) => {
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
                  {isCurrent && <span className="ml-auto text-[10px] uppercase opacity-50">atual</span>}
                </button>
              );
            })}
          </div>
        );
      })()}
    </>
  );
}
