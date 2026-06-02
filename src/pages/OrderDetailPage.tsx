import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import { AddPaymentModal } from '../modals/AddPaymentModal';
import type { OrderResponseDTO, PaymentResponseDTO, OrderBalanceDTO } from '../types';
import {
  formatBRL,
  formatOrderId,
  formatDateTime,
  getOrderStatusBadge,
  getPaymentStatusBadge,
} from '../utils/format';


export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { http } = useAuth();

  const [order, setOrder] = useState<OrderResponseDTO | null>(null);
  const [payments, setPayments] = useState<PaymentResponseDTO[]>([]);
  const [balance, setBalance] = useState<OrderBalanceDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const [showAddPayment, setShowAddPayment] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAll = useCallback(() => {
    if (!http || !id) return;
    setLoading(true);
    Promise.all([
      http.get<OrderResponseDTO>(`/orders/${id}`),
      http.get<PaymentResponseDTO[]>(`/payments/orders/${id}`),
      http.get<OrderBalanceDTO>(`/payments/orders/${id}/balance`),
    ])
      .then(([orderRes, paymentsRes, balanceRes]) => {
        setOrder(orderRes.data);
        setPayments(paymentsRes.data);
        setBalance(balanceRes.data);
      })
      .catch(() => navigate('/orders'))
      .finally(() => setLoading(false));
  }, [http, id, navigate]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleChangeStatus(status: string) {
    setActionLoading(true);
    try {
      await http!.patch(`/orders/${id}/status`, null, { params: { status } });
      fetchAll();
    } finally {
      setActionLoading(false);
    }
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) return null;

  const orderBadge = getOrderStatusBadge(order.status);
  const paymentBadge = getPaymentStatusBadge(order.paymentStatus);
  const STATUS_OPTIONS = [
    { value: 'PENDING',   label: 'Pendente',    icon: 'pending_actions', className: 'border-yellow-300 text-yellow-700 hover:bg-yellow-50' },
    { value: 'SHIPPED',   label: 'Em Trânsito', icon: 'local_shipping',  className: 'border-blue-300 text-blue-700 hover:bg-blue-50' },
    { value: 'DELIVERED', label: 'Entregue',    icon: 'check_circle',    className: 'border-green-300 text-green-700 hover:bg-green-50' },
    { value: 'CANCELLED', label: 'Cancelado',   icon: 'cancel',          className: 'border-red-300 text-error hover:bg-error/5' },
  ];

  return (
    <>
      <TopBar />

      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        <nav className="flex items-center gap-1 text-label-sm text-on-surface-variant">
          <button onClick={() => navigate('/orders')} className="hover:text-primary transition-colors">
            Pedidos
          </button>
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          <span className="text-on-surface font-bold">{formatOrderId(order.id)}</span>
        </nav>

        {/* Header bento */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3 bg-surface border border-outline-variant rounded-xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-label-sm text-primary font-bold tracking-widest uppercase">Order ID</span>
                <h2 className="text-h2 text-on-surface">{formatOrderId(order.id)}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-body-md text-on-surface-variant">
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person</span>
                  <span className="font-semibold text-on-surface">{order.clientName}</span>
                </div>
                <span className="text-outline">•</span>
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>calendar_today</span>
                  <span>{formatDateTime(order.createDate)}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`px-3 py-1.5 rounded-full text-label-sm font-bold inline-flex items-center gap-1.5 ${orderBadge.className}`}>
                {orderBadge.label}
              </span>
              <span className={`px-3 py-1.5 rounded-full text-label-sm font-bold ${paymentBadge.className}`}>
                {paymentBadge.label}
              </span>
            </div>
          </div>

          <div className="bg-surface border border-outline-variant rounded-xl p-6 shadow-sm flex flex-col justify-between">
            <span className="text-label-sm text-secondary font-bold uppercase">Entrega Prevista</span>
            <div className="flex items-end justify-between mt-2">
              <div>
                <p className="text-h3 text-on-surface">
                  {order.deliveryDate
                    ? new Date(order.deliveryDate).toLocaleDateString('pt-BR')
                    : '—'}
                </p>
                <p className="text-label-sm text-on-surface-variant">
                  {order.deliveryDate ? 'Data acordada' : 'Sem data definida'}
                </p>
              </div>
              <span className="material-symbols-outlined text-primary" style={{ fontSize: '32px' }}>
                event_available
              </span>
            </div>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Left: items + payments */}
          <div className="xl:col-span-2 space-y-4">
            {/* Items */}
            <section className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
                <h3 className="text-h3 text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">inventory</span>
                  Itens do Pedido
                </h3>
                <span className="text-label-sm text-secondary">
                  {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="overflow-x-auto">
                {(() => {
                  const hasGasItems = order.items.some((i) => i.supplierId);
                  return (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-container text-on-surface-variant text-label-sm border-b border-outline-variant">
                          <th className="px-6 py-3 font-semibold uppercase">Produto</th>
                          <th className="px-6 py-3 font-semibold uppercase text-center">Qtd</th>
                          {hasGasItems && (
                            <th className="px-6 py-3 font-semibold uppercase">Distribuidor</th>
                          )}
                          <th className="px-6 py-3 font-semibold uppercase text-right">Preço Unit.</th>
                          <th className="px-6 py-3 font-semibold uppercase text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant">
                        {order.items.map((item) => {
                          const isGas = !!item.supplierId;
                          return (
                            <tr key={item.id} className="hover:bg-surface-container/50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center border flex-shrink-0 ${
                                    isGas
                                      ? 'bg-tertiary/10 border-tertiary/20'
                                      : 'bg-blue-50 border-blue-100'
                                  }`}>
                                    <span className={`material-symbols-outlined ${
                                      isGas ? 'text-tertiary' : 'text-blue-500'
                                    }`} style={{ fontSize: '20px' }}>
                                      {isGas ? 'propane_tank' : 'water_drop'}
                                    </span>
                                  </div>
                                  <p className="font-semibold text-on-surface">{item.productName}</p>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center font-medium text-on-surface">{item.quantity}</td>
                              {hasGasItems && (
                                <td className="px-6 py-4">
                                  {item.supplierId ? (
                                    <div className="flex items-center gap-2">
                                      <span className="material-symbols-outlined text-tertiary" style={{ fontSize: '16px' }}>local_shipping</span>
                                      <span className="text-body-md font-semibold text-on-surface">{item.supplierName}</span>
                                    </div>
                                  ) : (
                                    <span className="text-on-surface-variant text-sm">—</span>
                                  )}
                                </td>
                              )}
                              <td className="px-6 py-4 text-right text-on-surface-variant">
                                {formatBRL(item.unitPrice)}
                              </td>
                              <td className="px-6 py-4 text-right font-bold text-primary">
                                {formatBRL(item.subTotal)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </section>

            {/* Payments */}
            <section className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
                <h3 className="text-h3 text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">receipt_long</span>
                  Histórico de Pagamentos
                </h3>
                <button
                  onClick={() => setShowAddPayment(true)}
                  className="text-primary hover:text-primary/80 text-label-sm font-bold flex items-center gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                  Adicionar
                </button>
              </div>
              <div className="p-4 space-y-3">
                {payments.length === 0 ? (
                  <p className="text-center text-on-surface-variant text-body-md py-6">
                    Nenhum pagamento registrado.
                  </p>
                ) : (
                  payments.map((pay) => (
                    <div
                      key={pay.id}
                      className="flex items-center justify-between p-4 border border-outline-variant rounded-lg bg-surface-bright"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center">
                          <span className="material-symbols-outlined text-primary" style={{ fontSize: '18px' }}>
                            payments
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-on-surface">{pay.paymentMethod}</p>
                          <p className="text-label-sm text-on-surface-variant">
                            {formatDateTime(pay.paymentDate)}
                            {pay.notes && ` • ${pay.notes}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-on-surface">{formatBRL(pay.amount)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Right: summary + actions */}
          <div className="space-y-4">
            {/* Financial summary */}
            <section className="bg-surface border border-outline-variant rounded-xl p-6 shadow-sm">
              <h3 className="text-label-sm text-secondary font-bold uppercase mb-5">Resumo Financeiro</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-body-md">
                  <span className="text-on-surface-variant">Total do Pedido</span>
                  <span className="font-bold text-on-surface">
                    {formatBRL(balance?.totalValue ?? order.totalValue)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-body-md">
                  <span className="text-on-surface-variant">Pago até agora</span>
                  <span className="font-semibold text-green-600">
                    − {formatBRL(balance?.totalPaid ?? 0)}
                  </span>
                </div>
                <div className="h-px bg-outline-variant" />
                <div className="flex justify-between items-center">
                  <span className="text-h3 text-on-surface">Total do Pedido</span>
                  <span className="text-h3 text-on-surface">
                    {formatBRL(balance?.totalValue ?? order.totalValue)}
                  </span>
                </div>
                {(balance?.remainingBalance ?? 0) > 0 && (
                  <div className="bg-primary/5 p-4 rounded-lg flex justify-between items-center">
                    <span className="text-primary font-bold">SALDO DEVEDOR</span>
                    <span className="text-primary font-black text-h3">
                      {formatBRL(balance?.remainingBalance ?? 0)}
                    </span>
                  </div>
                )}
                {(balance?.remainingBalance ?? 0) <= 0 && balance !== null && (
                  <div className="bg-green-50 p-4 rounded-lg flex justify-between items-center">
                    <span className="text-green-700 font-bold">QUITADO</span>
                    <span className="material-symbols-outlined text-green-600">check_circle</span>
                  </div>
                )}
              </div>
            </section>

            {/* Actions */}
            <section className="bg-surface border border-outline-variant rounded-xl p-6 shadow-sm">
              <h3 className="text-label-sm text-secondary font-bold uppercase mb-4">Alterar Status</h3>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {STATUS_OPTIONS.map((opt) => {
                  const isCurrent = order.status === opt.value;
                  return (
                    <button
                      key={opt.value}
                      disabled={isCurrent || actionLoading}
                      onClick={() => handleChangeStatus(opt.value)}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-bold transition-all disabled:cursor-default ${
                        isCurrent
                          ? 'bg-surface-container border-outline-variant text-on-surface-variant opacity-60'
                          : opt.className
                      }`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{opt.icon}</span>
                      {opt.label}
                      {isCurrent && <span className="text-[9px] opacity-70 ml-0.5">✓</span>}
                    </button>
                  );
                })}
              </div>
              <div className="h-px bg-outline-variant mb-4" />
              <div className="space-y-2">
                <button
                  onClick={() => setShowAddPayment(true)}
                  className="w-full py-2.5 border border-primary text-primary rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-primary/5 transition-all"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>payments</span>
                  Registrar Pagamento
                </button>
              </div>
            </section>

            {/* Status tracker */}
            <section className="bg-surface border border-outline-variant rounded-xl p-6 shadow-sm">
              <h3 className="text-label-sm text-secondary font-bold uppercase mb-5">Status do Pedido</h3>
              <div className="relative pl-6 border-l-2 border-outline-variant space-y-5">
                {[
                  { status: 'PENDING', label: 'Pendente', icon: 'pending_actions' },
                  { status: 'SHIPPED', label: 'Em Trânsito', icon: 'local_shipping' },
                  { status: 'DELIVERED', label: 'Entregue', icon: 'check_circle' },
                ].map((step) => {
                  const statuses = ['PENDING', 'SHIPPED', 'DELIVERED'];
                  const currentIdx = statuses.indexOf(order.status);
                  const stepIdx = statuses.indexOf(step.status);
                  const isDone = stepIdx <= currentIdx && order.status !== 'CANCELLED';
                  const isCurrent = step.status === order.status;
                  return (
                    <div key={step.status} className="relative">
                      <div
                        className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full border-4 ${
                          isCurrent
                            ? 'bg-primary border-primary-fixed'
                            : isDone
                            ? 'bg-green-500 border-green-100'
                            : 'bg-outline-variant border-surface'
                        }`}
                      />
                      <p className={`text-label-sm font-bold ${isDone ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                        {step.label}
                      </p>
                    </div>
                  );
                })}
                {order.status === 'CANCELLED' && (
                  <div className="relative">
                    <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-error border-4 border-error-container" />
                    <p className="text-label-sm font-bold text-error">Cancelado</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      <AddPaymentModal
        open={showAddPayment}
        orderId={order.id}
        onClose={() => setShowAddPayment(false)}
        onSuccess={fetchAll}
      />

    </>
  );
}
