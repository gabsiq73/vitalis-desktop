import { useEffect, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { AddPaymentModal } from './AddPaymentModal';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { useScrollToError } from '../hooks/useScrollToError';
import { formatBRL, formatOrderId } from '../utils/format';
import { parseApiError } from '../utils/parseApiError';
import type { ConfirmDeliveryRequestDTO, PaymentMethod, OrderResponseDTO } from '../types';

interface Props { orderId: string; onClose: () => void; onSuccess: () => void }
interface Selection { receiver: '' | 'DEPOT' | 'SUPPLIER'; method: PaymentMethod | '' }

export function ConfirmDeliveryModal({ orderId, onClose, onSuccess }: Props) {
  const { http } = useAuth();
  const { notify } = useNotification();
  const [order, setOrder] = useState<OrderResponseDTO | null>(null);
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [paymentReviewed, setPaymentReviewed] = useState(false);
  const errorRef = useScrollToError<HTMLParagraphElement>(error);

  useEffect(() => {
    if (!http) return;
    let active = true;
    setLoading(true);
    setError('');
    http.get<OrderResponseDTO>(`/orders/${orderId}`).then(response => {
      if (!active) return;
      setOrder(response.data);
      setSelections(Object.fromEntries(response.data.items.filter(item => item.supplierId || item.receivedByUs != null).map(item => [item.id, {
        receiver: item.receivedByUs == null ? '' : item.receivedByUs ? 'DEPOT' : 'SUPPLIER',
        method: item.gasPaymentMethod ?? '',
      }])));
    }).catch(err => { if (active) setError(parseApiError(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [http, orderId, retry]);

  const gasItems = order?.items.filter(item => item.supplierId || item.receivedByUs != null) ?? [];
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!http || !order || submitting.current) return;
    if (gasItems.some(item => !selections[item.id]?.receiver || (selections[item.id].receiver === 'DEPOT' && !selections[item.id].method))) {
      setError('Revise quem recebeu cada item de gás e informe PIX ou Dinheiro para o depósito.');
      return;
    }
    const payload: ConfirmDeliveryRequestDTO | undefined = gasItems.length ? { gasPayments: gasItems.map(item => ({
      orderItemId: item.id,
      receivedByUs: selections[item.id].receiver === 'DEPOT',
      gasPaymentMethod: selections[item.id].receiver === 'DEPOT' ? selections[item.id].method as PaymentMethod : null,
    })) } : undefined;
    submitting.current = true;
    setSaving(true);
    setError('');
    try {
      await http.patch(`/orders/${orderId}/confirm-delivery`, payload);
      notify('Entrega confirmada com sucesso.', 'success');
      onSuccess();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  const inputClass = 'mt-1 w-full border border-outline-variant rounded-lg bg-surface-container-lowest px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none';
  const unavailable = order?.status === 'DELIVERED' || order?.status === 'CANCELLED';
  if (order && !unavailable && order.paymentStatus !== 'PAID' && !paymentReviewed) {
    return <AddPaymentModal
      open orderId={orderId} forDelivery
      onClose={onClose}
      onSuccess={() => setPaymentReviewed(true)}
      onFiado={() => setPaymentReviewed(true)}
    />;
  }
  return (
    <Modal open title="Confirmar entrega" maxWidth="max-w-2xl" onClose={() => { if (!submitting.current) onClose(); }}>
      <form onSubmit={submit} className="p-6 space-y-4 overflow-y-auto">
        {error && <p ref={errorRef} role="alert" className="p-3 rounded-lg bg-red-50 text-sm text-red-700">{error}</p>}
        {loading ? <p className="text-sm text-on-surface-variant">Carregando pedido...</p> : !order ? <button type="button" onClick={() => setRetry(value => value + 1)} className="text-primary text-sm">Tentar novamente</button> : <>
          <p className="text-sm text-on-surface-variant">Pedido {formatOrderId(order.id)} · {order.clientName}</p>
          {unavailable ? <p role="alert" className="text-sm text-error">Este pedido já foi entregue ou cancelado. Atualize a lista.</p> : <>
            <p className="text-sm text-on-surface-variant">{gasItems.length ? 'Revise o recebimento do gás antes de confirmar. Os dados abaixo preservam a seleção do pedido.' : 'Confirma a entrega dos itens deste pedido? A baixa do estoque de água será realizada.'}</p>
            <fieldset disabled={saving} className="space-y-4">
              {gasItems.map(item => {
                const selection = selections[item.id];
                const cost = item.gasCostPrice == null ? null : item.gasCostPrice * item.quantity;
                const margin = cost == null ? null : item.subTotal - cost;
                return <div key={item.id} className="p-4 rounded-lg border border-outline-variant space-y-3">
                  <p className="font-bold text-on-surface">{item.productName} × {item.quantity}</p>
                  <p className="text-sm text-on-surface-variant">Venda ao cliente: {formatBRL(item.subTotal)} · Margem: {margin == null ? 'Indisponível' : formatBRL(margin)}</p>
                  <div>
                    <label htmlFor={`receiver-${item.id}`} className="text-sm text-on-surface-variant">Quem recebeu do cliente?</label>
                    <select id={`receiver-${item.id}`} required value={selection?.receiver ?? ''} onChange={e => setSelections(prev => ({ ...prev, [item.id]: { receiver: e.target.value as Selection['receiver'], method: '' } }))} className={inputClass}>
                      <option value="">Selecione...</option><option value="SUPPLIER">Entregador da fornecedora</option><option value="DEPOT">Depósito (recebido por nós)</option>
                    </select>
                  </div>
                  {selection?.receiver === 'DEPOT' && <div>
                    <label htmlFor={`method-${item.id}`} className="text-sm text-on-surface-variant">Forma de pagamento recebida no depósito</label>
                    <select id={`method-${item.id}`} required value={selection.method} onChange={e => setSelections(prev => ({ ...prev, [item.id]: { ...prev[item.id], method: e.target.value as Selection['method'] } }))} className={inputClass}>
                      <option value="">Selecione...</option><option value="PIX">PIX</option><option value="DINHEIRO">Dinheiro</option>
                      {item.gasPaymentMethod === 'SALDO' && <option value="SALDO">Saldo já registrado</option>}
                    </select>
                  </div>}
                  {selection?.receiver && <p className="text-sm text-on-surface-variant">{selection.receiver === 'SUPPLIER'
                    ? `Sem entrada no caixa do depósito. Margem a receber da fornecedora: ${margin == null ? 'Indisponível' : formatBRL(margin)}. Confira o repasse em Acertos de Gás.`
                    : `Valor da venda: ${formatBRL(item.subTotal)}. Custo a repassar à fornecedora: ${cost == null ? 'Indisponível' : formatBRL(cost)}. Pagamentos já registrados serão preservados.`}</p>}
                </div>;
              })}
            </fieldset>
          </>}
        </>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" disabled={saving} onClick={onClose} className="px-4 py-2.5 border border-outline-variant rounded-lg text-on-surface-variant disabled:opacity-50">Cancelar</button>
          <button type="submit" disabled={loading || saving || !order || unavailable} className="px-4 py-2.5 bg-primary text-on-primary rounded-lg font-bold disabled:opacity-50">{saving ? 'Confirmando...' : 'Confirmar entrega'}</button>
        </div>
      </form>
    </Modal>
  );
}
