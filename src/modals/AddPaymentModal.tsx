import { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import type { PaymentRequestDTO, PaymentMethod, OrderBalanceDTO } from '../types';
import { formatBRL } from '../utils/format';
import { useScrollToError } from '../hooks/useScrollToError';

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

function nowPaymentDate() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

export function AddPaymentModal({ open, orderId, onClose, onSuccess }: AddPaymentModalProps) {
  const { http } = useAuth();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('PIX');
  const [cashReceived, setCashReceived] = useState('');
  const [notes, setNotes] = useState('');

  const [combine, setCombine] = useState(false);
  const [amount2, setAmount2] = useState('');
  const [method2, setMethod2] = useState<PaymentMethod>('DINHEIRO');
  const [cashReceived2, setCashReceived2] = useState('');

  const [loading, setLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balance, setBalance] = useState<OrderBalanceDTO | null>(null);
  const [error, setError] = useState('');
  const errorRef = useScrollToError<HTMLParagraphElement>(error);

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
    setCashReceived('');
    setNotes('');
    setCombine(false);
    setAmount2('');
    setMethod2('DINHEIRO');
    setCashReceived2('');
    setError('');
    setBalance(null);
    onClose();
  }

  function selectMethod(value: PaymentMethod) {
    setMethod(value);
    if (combine && value === method2) setMethod2(PAYMENT_METHODS.find((m) => m.value !== value)!.value);
  }

  function selectMethod2(value: PaymentMethod) {
    setMethod2(value);
    if (value === method) setMethod(PAYMENT_METHODS.find((m) => m.value !== value)!.value);
  }

  function addSecondPayment() {
    const base = balance?.remainingBalance ?? parseFloat(amount) ?? 0;
    if (base > 0) {
      const half = Math.round((base / 2) * 100) / 100;
      setAmount(half.toFixed(2));
      setAmount2((base - half).toFixed(2));
    }
    if (method2 === method) {
      setMethod2(PAYMENT_METHODS.find((m) => m.value !== method)!.value);
    }
    setCombine(true);
  }

  function removeSecondPayment() {
    setCombine(false);
    setAmount2('');
    setMethod2('DINHEIRO');
    setCashReceived2('');
    if (balance && balance.remainingBalance > 0) setAmount(balance.remainingBalance.toFixed(2));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value1 = parseFloat(amount);
    const value2 = combine ? parseFloat(amount2) : 0;

    if (isNaN(value1) || value1 <= 0) { setError('Valor deve ser maior que zero.'); return; }
    if (combine && (isNaN(value2) || value2 <= 0)) { setError('Informe o valor do segundo meio de pagamento.'); return; }
    if (combine && method === method2) { setError('Escolha dois meios de pagamento diferentes.'); return; }
    if (notes && notes.length < 5) { setError('Observação deve ter mínimo 5 caracteres.'); return; }

    setLoading(true);
    setError('');
    try {
      const paymentDate = nowPaymentDate();
      const payload1: PaymentRequestDTO = {
        orderId,
        amount: value1,
        paymentMethod: method,
        paymentDate,
        notes: notes.trim() || undefined,
      };
      await http!.post('/payments', payload1);

      if (combine) {
        try {
          const payload2: PaymentRequestDTO = {
            orderId,
            amount: value2,
            paymentMethod: method2,
            paymentDate,
            notes: notes.trim() || undefined,
          };
          await http!.post('/payments', payload2);
        } catch {
          setError(`O pagamento em ${PAYMENT_METHODS.find((m) => m.value === method)?.label} (${formatBRL(value1)}) foi registrado, mas o segundo meio falhou. Registre o restante manualmente.`);
          onSuccess();
          setLoading(false);
          return;
        }
      }

      onSuccess();
      handleClose();
    } catch {
      setError('Erro ao registrar pagamento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = 'w-full px-4 py-2.5 border border-slate-200 rounded-lg text-[15px] font-bold bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-slate-800 placeholder-slate-400';

  const totalEntered = (parseFloat(amount) || 0) + (combine ? (parseFloat(amount2) || 0) : 0);
  const isPartial = balance && totalEntered > 0 && totalEntered < balance.remainingBalance;
  const isOverpayment = balance && totalEntered > balance.remainingBalance;

  const troco1 = method === 'DINHEIRO' && cashReceived ? parseFloat(cashReceived) - (parseFloat(amount) || 0) : null;
  const troco2 = combine && method2 === 'DINHEIRO' && cashReceived2 ? parseFloat(cashReceived2) - (parseFloat(amount2) || 0) : null;

  return (
    <Modal open={open} onClose={handleClose} title="Registrar Pagamento" maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

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

          {/* Payment 1 */}
          <div className="space-y-3">
            {combine && <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">1º meio de pagamento</p>}
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
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Forma de Pagamento *
              </label>
              <div className="flex gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    disabled={combine && m.value === method2}
                    onClick={() => selectMethod(m.value)}
                    className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border text-[11px] font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
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

            {method === 'DINHEIRO' && (
              <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-lg">
                <label className="block text-[11px] font-semibold text-emerald-700 uppercase tracking-wider mb-1.5">
                  Valor recebido em dinheiro
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  placeholder="0,00"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                />
                {troco1 !== null && troco1 > 0 && (
                  <p className="mt-1.5 text-[12px] text-emerald-700 font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>payments</span>
                    Troco: {formatBRL(troco1)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Payment 2 */}
          {combine && (
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">2º meio de pagamento</p>
                <button
                  type="button"
                  onClick={removeSecondPayment}
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-red-500 transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                  Remover
                </button>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Valor (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className={inputClass}
                  placeholder="0,00"
                  value={amount2}
                  onChange={(e) => setAmount2(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Forma de Pagamento *
                </label>
                <div className="flex gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      disabled={m.value === method}
                      onClick={() => selectMethod2(m.value)}
                      className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border text-[11px] font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                        method2 === m.value
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

              {method2 === 'DINHEIRO' && (
                <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-lg">
                  <label className="block text-[11px] font-semibold text-emerald-700 uppercase tracking-wider mb-1.5">
                    Valor recebido em dinheiro
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={inputClass}
                    placeholder="0,00"
                    value={cashReceived2}
                    onChange={(e) => setCashReceived2(e.target.value)}
                  />
                  {troco2 !== null && troco2 > 0 && (
                    <p className="mt-1.5 text-[12px] text-emerald-700 font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>payments</span>
                      Troco: {formatBRL(troco2)}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Add 2nd payment method — split-tender pattern, one line at a time */}
          {!combine && (
            <button
              type="button"
              onClick={addSecondPayment}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-slate-300 rounded-lg text-[12px] font-semibold text-slate-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add_circle</span>
              Dividir em 2 meios de pagamento
            </button>
          )}

          {/* Combined total feedback */}
          {balance && totalEntered > 0 && (
            <>
              {combine && (
                <p className="text-[12px] text-slate-500 flex items-center justify-between">
                  <span>Total combinado</span>
                  <span className="font-bold text-slate-700">{formatBRL(totalEntered)}</span>
                </p>
              )}
              {isPartial && (
                <p className="text-[11px] text-amber-600 flex items-center gap-1">
                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>info</span>
                  Pagamento parcial — restará {formatBRL(balance.remainingBalance - totalEntered)}
                </p>
              )}
              {isOverpayment && (
                <p className="text-[11px] text-blue-600 flex items-center gap-1">
                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>info</span>
                  Excede o saldo — {formatBRL(totalEntered - balance.remainingBalance)} virará crédito do cliente
                </p>
              )}
            </>
          )}

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
            <p ref={errorRef} className="text-[13px] text-red-600 flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>error</span>
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-3 justify-end px-6 py-4 border-t border-slate-200 flex-shrink-0">
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
