import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import { AddPaymentModal } from '../modals/AddPaymentModal';
import { EditOrderModal } from '../modals/EditOrderModal';
import type { OrderResponseDTO, PaymentResponseDTO, OrderBalanceDTO } from '../types';
import {
  formatBRL,
  formatOrderId,
  formatDateTime,
  getOrderStatusBadge,
  getPaymentStatusBadge,
} from '../utils/format';

const STATUS_STEPS = [
  { value: 'PENDING',   label: 'Pendente',    icon: 'pending_actions' },
  { value: 'SHIPPED',   label: 'Em Trânsito', icon: 'local_shipping' },
  { value: 'DELIVERED', label: 'Entregue',    icon: 'check_circle' },
];

const STATUS_ACTIONS = [
  { value: 'PENDING',   label: 'Pendente',    icon: 'pending_actions', cls: 'border-yellow-200 text-yellow-700 hover:bg-yellow-50' },
  { value: 'SHIPPED',   label: 'Em Trânsito', icon: 'local_shipping',  cls: 'border-blue-200 text-blue-700 hover:bg-blue-50' },
  { value: 'DELIVERED', label: 'Entregue',    icon: 'check_circle',    cls: 'border-green-200 text-green-700 hover:bg-green-50' },
  { value: 'CANCELLED', label: 'Cancelado',   icon: 'cancel',          cls: 'border-red-200 text-red-600 hover:bg-red-50' },
];

const METHOD_LABELS: Record<string, string> = {
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
  SALDO: 'Saldo',
};

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { http } = useAuth();

  const [order, setOrder] = useState<OrderResponseDTO | null>(null);
  const [payments, setPayments] = useState<PaymentResponseDTO[]>([]);
  const [balance, setBalance] = useState<OrderBalanceDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showEditOrder, setShowEditOrder] = useState(false);
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
    if (actionLoading) return;
    setActionLoading(true);
    try {
      if (status === 'DELIVERED') {
        await http!.patch(`/orders/${id}/confirm-delivery`);
      } else if (status === 'CANCELLED') {
        await http!.delete(`/orders/${id}`);
      } else {
        await http!.patch(`/orders/${id}/status`, null, { params: { status } });
      }
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
  const payBadge = getPaymentStatusBadge(order.paymentStatus);
  const remaining = balance?.remainingBalance ?? 0;
  const totalPaid = balance?.totalPaid ?? 0;
  const totalValue = balance?.totalValue ?? order.totalValue;
  const isFullyPaid = remaining <= 0 && balance !== null;
  const isCancelled = order.status === 'CANCELLED';
  const isDelivered = order.status === 'DELIVERED';

  const currentStepIdx = isCancelled ? -1 : STATUS_STEPS.findIndex((s) => s.value === order.status);
  const hasGasItems = order.items.some((i) => i.supplierId);

  return (
    <>
      <TopBar />

      <div className="p-6 max-w-7xl mx-auto space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[13px] text-slate-500">
          <button onClick={() => navigate('/orders')} className="hover:text-primary transition-colors font-medium">
            Pedidos
          </button>
          <span className="material-symbols-outlined text-slate-300" style={{ fontSize: '16px' }}>chevron_right</span>
          <span className="text-slate-700 font-semibold">{formatOrderId(order.id)}</span>
        </div>

        {/* Header card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: '22px' }}>receipt_long</span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-[22px] font-black text-slate-800 font-mono tracking-tight">
                    {formatOrderId(order.id)}
                  </h1>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${orderBadge.className}`}>
                    {orderBadge.label}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${payBadge.className}`}>
                    {payBadge.label}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-1.5">
                  <button
                    onClick={() => navigate(`/clients/${order.clientId}`)}
                    className="flex items-center gap-1 text-[13px] text-primary hover:underline font-semibold"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>person</span>
                    {order.clientName}
                  </button>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1 text-[13px] text-slate-500">
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>schedule</span>
                    Criado {formatDateTime(order.createDate)}
                  </span>
                  {order.deliveryDate && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="flex items-center gap-1 text-[13px] text-slate-500">
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>event_available</span>
                        Entrega {new Date(order.deliveryDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Edit button + step tracker */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {!isCancelled && !isDelivered && (
                <button
                  onClick={() => setShowEditOrder(true)}
                  className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-lg text-[13px] font-semibold text-slate-600 hover:bg-slate-50 hover:border-primary/30 transition-all"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                  Editar
                </button>
              )}
            </div>

            {!isCancelled ? (
              <div className="flex items-center gap-0 flex-shrink-0">
                {STATUS_STEPS.map((step, idx) => {
                  const done = idx <= currentStepIdx;
                  const current = idx === currentStepIdx;
                  return (
                    <div key={step.value} className="flex items-center">
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${
                        current
                          ? 'bg-primary text-white border-primary'
                          : done
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{step.icon}</span>
                        {step.label}
                      </div>
                      {idx < STATUS_STEPS.length - 1 && (
                        <div className={`w-6 h-0.5 ${idx < currentStepIdx ? 'bg-green-300' : 'bg-slate-200'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>cancel</span>
                Pedido Cancelado
              </div>
            )}
          </div>
        </div>

        {/* Body grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* Left — items + payments */}
          <div className="xl:col-span-2 space-y-5">

            {/* Items */}
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-card">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: '18px' }}>inventory_2</span>
                  <h2 className="text-[15px] font-bold text-slate-800">Itens do Pedido</h2>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">
                    {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
                  </span>
                </div>
                <span className="text-[13px] font-bold text-slate-700">{formatBRL(totalValue)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Produto</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center">Qtd</th>
                      {hasGasItems && (
                        <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Distribuidor</th>
                      )}
                      <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Preço Unit.</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {order.items.map((item) => {
                      const isGas = !!item.supplierId;
                      const isBonus = item.unitPrice === 0;
                      return (
                        <tr key={item.id} className={`hover:bg-slate-50/60 transition-colors ${isBonus ? 'bg-green-50/40' : ''}`}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                isBonus ? 'bg-green-50' : isGas ? 'bg-orange-50' : 'bg-blue-50'
                              }`}>
                                <span className={`material-symbols-outlined ${isBonus ? 'text-green-500' : isGas ? 'text-orange-500' : 'text-blue-500'}`} style={{ fontSize: '18px' }}>
                                  {isGas ? 'propane_tank' : isBonus ? 'redeem' : 'water_drop'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-semibold text-slate-700">{item.productName}</span>
                                {isBonus && (
                                  <span className="text-[10px] font-black text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full border border-green-200">
                                    BÔNUS
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-[12px] font-bold text-slate-700">
                              {item.quantity}
                            </span>
                          </td>
                          {hasGasItems && (
                            <td className="px-5 py-3.5 text-[13px] text-slate-500">
                              {item.supplierName ?? <span className="text-slate-300">—</span>}
                            </td>
                          )}
                          <td className="px-5 py-3.5 text-right text-[13px] text-slate-500">
                            {isBonus ? (
                              <span className="text-green-600 font-bold">R$ 0,00</span>
                            ) : (
                              formatBRL(item.unitPrice)
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right text-[13px] font-bold text-slate-800">
                            {isBonus ? (
                              <span className="text-green-600">R$ 0,00</span>
                            ) : (
                              formatBRL(item.subTotal)
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50">
                      <td colSpan={hasGasItems ? 3 : 2} className="px-5 py-3 text-[12px] font-semibold text-slate-500 uppercase tracking-wider">
                        Total
                      </td>
                      <td />
                      <td className="px-5 py-3 text-right text-[15px] font-black text-slate-800">
                        {formatBRL(totalValue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* Payment history */}
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-card">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: '18px' }}>receipt_long</span>
                  <h2 className="text-[15px] font-bold text-slate-800">Histórico de Pagamentos</h2>
                  {payments.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">
                      {payments.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowAddPayment(true)}
                  className="flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>add</span>
                  Adicionar
                </button>
              </div>

              {payments.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <span className="material-symbols-outlined block mb-2 text-slate-200" style={{ fontSize: '36px' }}>payments</span>
                  <p className="text-[13px] text-slate-400">Nenhum pagamento registrado.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {payments.map((pay) => (
                    <div key={pay.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-green-600" style={{ fontSize: '16px' }}>check</span>
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-slate-700">
                            {METHOD_LABELS[pay.paymentMethod] ?? pay.paymentMethod}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {formatDateTime(pay.paymentDate)}
                            {pay.notes && <span className="ml-1 text-slate-400">· {pay.notes}</span>}
                          </p>
                        </div>
                      </div>
                      <span className="text-[14px] font-bold text-green-700">+{formatBRL(pay.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right — financial + actions */}
          <div className="space-y-4">

            {/* Financial summary */}
            <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
              <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-4">Resumo Financeiro</h3>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-slate-500">Valor do pedido</span>
                  <span className="font-semibold text-slate-700">{formatBRL(totalValue)}</span>
                </div>
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-slate-500">Total pago</span>
                  <span className="font-semibold text-green-600">{formatBRL(totalPaid)}</span>
                </div>
              </div>

              <div className="h-px bg-slate-100 mb-4" />

              {isFullyPaid ? (
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-green-600" style={{ fontSize: '22px' }}>check_circle</span>
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-green-700">Pagamento Quitado</p>
                    <p className="text-[11px] text-green-600">Sem pendências</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                  <p className="text-[11px] font-semibold text-red-500 uppercase tracking-wider mb-1">Saldo Devedor</p>
                  <p className="text-[30px] font-black text-red-600 leading-none">{formatBRL(remaining)}</p>
                  <p className="text-[11px] text-red-400 mt-1">pendente de pagamento</p>
                </div>
              )}

              {!isFullyPaid && !isCancelled && (
                <button
                  onClick={() => setShowAddPayment(true)}
                  className="mt-4 w-full py-2.5 bg-primary text-white rounded-lg font-bold text-[13px] flex items-center justify-center gap-2 shadow-md shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>payments</span>
                  Registrar Pagamento
                </button>
              )}
            </section>

            {/* Status actions */}
            {!isCancelled && !isDelivered && (
              <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
                <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Alterar Status</h3>
                <div className="space-y-2">
                  {STATUS_ACTIONS.filter((a) => a.value !== 'PENDING' || order.status !== 'DELIVERED').map((opt) => {
                    const isCurrent = order.status === opt.value;
                    if (isCurrent) return null;
                    return (
                      <button
                        key={opt.value}
                        disabled={actionLoading}
                        onClick={() => handleChangeStatus(opt.value)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-[13px] font-semibold transition-all disabled:opacity-50 ${opt.cls}`}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>{opt.icon}</span>
                        {actionLoading ? 'Atualizando...' : `Mover para ${opt.label}`}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Client shortcut */}
            <button
              onClick={() => navigate(`/clients/${order.clientId}`)}
              className="w-full flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-primary/30 hover:bg-primary/5 transition-all group shadow-sm"
            >
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-black text-[14px] flex-shrink-0">
                {order.clientName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 text-left">
                <p className="text-[13px] font-semibold text-slate-700 group-hover:text-primary transition-colors">{order.clientName}</p>
                <p className="text-[11px] text-slate-400">Ver perfil do cliente</p>
              </div>
              <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors" style={{ fontSize: '18px' }}>arrow_forward</span>
            </button>
          </div>
        </div>
      </div>

      {showEditOrder && (
        <EditOrderModal
          open={showEditOrder}
          order={order}
          onClose={() => setShowEditOrder(false)}
          onSuccess={() => { setShowEditOrder(false); fetchAll(); }}
        />
      )}

      <AddPaymentModal
        open={showAddPayment}
        orderId={order.id}
        onClose={() => setShowAddPayment(false)}
        onSuccess={fetchAll}
      />
    </>
  );
}
