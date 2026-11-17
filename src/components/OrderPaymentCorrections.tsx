import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { PaymentResponseDTO } from '../types';
import { formatBRL, formatDateTime } from '../utils/format';
import { parseApiError } from '../utils/parseApiError';

export function OrderPaymentCorrections({ orderId, onEdit, disabled }: {
  orderId: string;
  onEdit: (payment: PaymentResponseDTO) => void;
  disabled: boolean;
}) {
  const { http } = useAuth();
  const [payments, setPayments] = useState<PaymentResponseDTO[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!http) return;
    let active = true;
    http.get<PaymentResponseDTO[]>(`/payments/orders/${orderId}`)
      .then(({ data }) => {
        if (active) setPayments(data.filter(p => p.paymentMethod === 'PIX' || p.paymentMethod === 'DINHEIRO'));
      })
      .catch(err => { if (active) setError(parseApiError(err)); });
    return () => { active = false; };
  }, [http, orderId]);

  if (error) return <p role="alert" className="text-sm text-red-700">Pagamentos: {error}</p>;
  if (!payments.length) return null;

  return (
    <section aria-label="Pagamentos registrados" className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-700">Pagamentos registrados</h3>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {payments.map(payment => (
          <li key={payment.id} className="flex items-center justify-between gap-2 px-3 py-1">
            <span className="text-sm text-slate-700">
              {formatBRL(payment.amount)} · {payment.paymentMethod === 'PIX' ? 'PIX' : 'Dinheiro'} · {formatDateTime(payment.paymentDate)}
            </span>
            <button
              type="button"
              title="Alterar forma de pagamento"
              aria-label={`Alterar forma de pagamento de ${formatBRL(payment.amount)}`}
              onClick={() => onEdit(payment)}
              disabled={disabled}
              className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/8 transition-all disabled:opacity-50"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">edit</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
