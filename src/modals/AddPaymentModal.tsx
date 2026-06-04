import { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import type { PaymentRequestDTO, PaymentMethod, OrderBalanceDTO } from '../types';
import { formatBRL } from '../utils/format';

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'PIX',      label: 'PIX',          icon: 'qr_code_2' },
  { value: 'DINHEIRO', label: 'Dinheiro',      icon: 'payments' },
  { value: 'SALDO',    label: 'Saldo em conta', icon: 'account_balance_wallet' },
];

interface AddPaymentModalProps {
  open: boolean;
  orderId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddPaymentModal({ open, orderId, onClose, onSuccess }: AddPaymentModalProps) {
  const { http } = useAuth();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('PIX');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balance, setBalance] = useState<OrderBalanceDTO | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !http || !orderId) return;
    setBalanceLoading(true);
    http.get<OrderBalanceDTO>(`/payments/orders/${orderId}/balance`)
      .then((res) => {
        setBalance(res.data);
        const debt = res.data.remainingBalance;
        if (debt > 0) setAmount(debt.toFixed(2));
      })
      .catch(() => setBalance(null))
      .finally(() => setBalanceLoading(false));
  }, [open, orderId, http]);

  function handleClose() {
    setAmount('');
    setMethod('PIX');
    setNotes('');
    setError('');
    setBalance(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) { setError('Valor deve ser maior que zero.'); return; }
    if (notes && notes.length < 5) { setError('Observação deve ter mínimo 5 caracteres.'); return; }
    setLoading(true);
    setError('');
    try {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const paymentDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const payload: PaymentRequestDTO = {
        orderId,
        amount: value,
        paymentMethod: method,
        paymentDate,
        notes: notes.trim() || undefined,
      };
      await http!.post('/payments', payload);
      onSuccess();
      handleClose();
    } catch {
      setError('Erro ao registrar pagamento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = 'w-full px-4 py-2.5 border border-slate-200 rounded-lg text-[15px] font-bold bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-slate-800 placeholder-slate-400';

  const isPartial = balance && amount && parseFloat(amount) < balance.remainingBalance && parseFloat(amount) > 0;
  const isOverpayment = balance && amount && parseFloat(amount) > balance.remainingBalance;

  return (
    <Modal open={open} onClose={handleClose} title="Registrar Pagamento" maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="p-6 space-y-5">

        {/* Order balance summary */}
        {balanceLoading ? (
          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-[13px] text-slate-400">Carregando saldo do pedido...</span>
          </div>
        ) : balance && (
          <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Total</p>
              <p className="text-[13px] font-bold text-slate-700">{formatBRL(balance.totalValue)}</p>
            </div>
            <div className="text-center border-x border-slate-200">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Pago</p>
              <p className="text-[13px] font-bold text-green-600">{formatBRL(balance.totalPaid)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Restante</p>
              <p className="text-[13px] font-bold text-orange-500">{formatBRL(balance.remainingBalance)}</p>
            </div>
          </div>
        )}

        {/* Amount */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Valor (R$) *
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            autoFocus
            className={inputClass}
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {isPartial && (
            <p className="mt-1 text-[11px] text-amber-600 flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>info</span>
              Pagamento parcial — restará {formatBRL(balance!.remainingBalance - parseFloat(amount))}
            </p>
          )}
          {isOverpayment && (
            <p className="mt-1 text-[11px] text-blue-600 flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>info</span>
              Excede o saldo — {formatBRL(parseFloat(amount) - balance!.remainingBalance)} virará crédito do cliente
            </p>
          )}
        </div>

        {/* Payment method */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Forma de Pagamento *
          </label>
          <div className="flex gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMethod(m.value)}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border text-[11px] font-bold transition-all ${
                  method === m.value
                    ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                    : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Observações <span className="normal-case text-slate-400 font-normal">(mín. 5 chars se preenchido)</span>
          </label>
          <textarea
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none text-slate-700"
            placeholder="Ex: Pagamento referente à parcela 1/2"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-[13px] text-red-600 flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>error</span>
            {error}
          </p>
        )}

        <div className="flex gap-3 justify-end pt-1">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-5 py-2.5 border border-slate-200 rounded-lg font-semibold text-[13px] text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || balanceLoading}
            className="px-6 py-2.5 bg-primary text-white rounded-lg font-bold text-[13px] hover:brightness-110 disabled:opacity-70 transition-all flex items-center gap-2 shadow-sm shadow-primary/20"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Registrando...
              </>
            ) : 'Confirmar Pagamento'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
