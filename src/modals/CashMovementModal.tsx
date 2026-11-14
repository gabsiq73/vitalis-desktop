import { useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { useScrollToError } from '../hooks/useScrollToError';
import type { CashMovementDirection, CashMovementType, FinancialReportDTO } from '../types';
import { buildCashMovement, cashDifference } from '../utils/cashMovement';
import { cashMovementApiError } from '../utils/parseApiError';
import { formatBRL } from '../utils/format';

const TITLES: Record<CashMovementType, string> = { ENTRY: 'Registrar entrada', WITHDRAWAL: 'Registrar retirada', ADJUSTMENT: 'Ajustar caixa' };

interface Props {
  type: CashMovementType;
  date: string;
  balance: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function CashMovementModal({ type, date, balance, onClose, onSuccess }: Props) {
  const { http } = useAuth();
  const { notify } = useNotification();
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<CashMovementDirection>('IN');
  const [conference, setConference] = useState(type === 'ADJUSTMENT');
  const [baseBalance, setBaseBalance] = useState(balance);
  const [occurredAt, setOccurredAt] = useState(() => `${date}T${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const errorRef = useScrollToError<HTMLParagraphElement>(error);
  const isConference = type === 'ADJUSTMENT' && conference;
  const difference = amount !== '' && Number.isFinite(Number(amount)) ? cashDifference(Number(amount), baseBalance) : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!http || submitting.current) return;
    setError('');
    let payload;
    try {
      if (occurredAt.slice(0, 10) !== date) throw new Error('Use a data selecionada no Caixa do Dia.');
      payload = buildCashMovement({ type, amount: amount === '' ? NaN : Number(amount), direction, occurredAt, note,
        ...(isConference ? { counted: amount === '' ? NaN : Number(amount), balance: baseBalance } : {}) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revise os dados do lançamento.');
      return;
    }
    submitting.current = true;
    setSaving(true);
    try {
      if (isConference) {
        const response = await http.get<FinancialReportDTO>('/reports/performance/daily', { params: { date } });
        if (response.data.finalBalance !== baseBalance) {
          setBaseBalance(response.data.finalBalance);
          setError('O saldo do caixa mudou. Confira o valor atualizado e a diferença antes de confirmar.');
          return;
        }
      }
      if (payload === null) {
        notify('O valor conferido está correto. Nenhum ajuste foi necessário.', 'info');
        onSuccess();
        return;
      }
      await http.post('/cash-movements', payload);
      notify('Movimentação de caixa registrada.', 'success');
      onSuccess();
    } catch (err) {
      setError(cashMovementApiError(err));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  const inputClass = 'w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none';
  return (
    <Modal open onClose={() => { if (!submitting.current) onClose(); }} title={TITLES[type]} maxWidth="max-w-lg">
      <form onSubmit={submit} className="overflow-y-auto p-6 space-y-4">
        <p className="text-sm text-slate-600">Data do caixa: {date.split('-').reverse().join('/')}. O lançamento pertence a esta data.</p>
        {error && <p ref={errorRef} role="alert" className="p-3 rounded-lg bg-red-50 text-sm text-red-700">{error}</p>}
        <fieldset disabled={saving} className="space-y-4">
          {type === 'ADJUSTMENT' && <label className="block text-sm font-medium text-slate-700">Forma de ajuste
            <select className={inputClass} value={conference ? 'CONFERENCE' : 'MANUAL'} onChange={e => { setConference(e.target.value === 'CONFERENCE'); setAmount(''); }}>
              <option value="CONFERENCE">Por conferência de valor</option><option value="MANUAL">Informar entrada ou saída</option>
            </select>
          </label>}
          {isConference && <div className="p-3 rounded-lg bg-blue-50 text-sm text-slate-700">
            <p>Saldo do dia: <strong>{formatBRL(baseBalance)}</strong></p>
            <p className="mt-1 text-xs">Inclui PIX, dinheiro e acertos de gás desta data.</p>
          </div>}
          <label className="block text-sm font-medium text-slate-700">{isConference ? 'Valor conferido (R$)' : 'Valor (R$)'}
            <input autoFocus type="number" min={isConference ? '0' : '0.01'} max="99999999.99" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} className={inputClass} />
          </label>
          {isConference && <p aria-live="polite" className="text-sm text-slate-700">Diferença: <strong>{difference === null ? '—' : `${difference > 0 ? '+' : ''}${formatBRL(difference)}`}</strong>{difference === 0 ? ' · Sem lançamento necessário.' : difference === null ? '' : difference > 0 ? ' · Ajuste de entrada.' : ' · Ajuste de saída.'}</p>}
          {type === 'ADJUSTMENT' && !conference && <label className="block text-sm font-medium text-slate-700">Entrada ou saída
            <select value={direction} onChange={e => setDirection(e.target.value as CashMovementDirection)} className={inputClass}><option value="IN">Entrada</option><option value="OUT">Saída</option></select>
          </label>}
          <label className="block text-sm font-medium text-slate-700">Data e horário
            <input type="datetime-local" required min={`${date}T00:00`} max={`${date}T23:59`} value={occurredAt} onChange={e => setOccurredAt(e.target.value)} className={inputClass} />
          </label>
          <label className="block text-sm font-medium text-slate-700">Motivo {type === 'WITHDRAWAL' ? '(obrigatório)' : '(opcional)'}
            <textarea required={type === 'WITHDRAWAL'} maxLength={255} value={note} onChange={e => setNote(e.target.value)} className={inputClass} rows={3} />
          </label>
        </fieldset>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" disabled={saving} onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 disabled:opacity-50">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50">{saving ? 'Registrando…' : isConference && difference === 0 ? 'Concluir conferência' : 'Registrar'}</button>
        </div>
      </form>
    </Modal>
  );
}
