import { useRef, useState, type FormEvent } from 'react';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import type { ClientBalanceUpdateDTO, ClientResponseDTO } from '../types';
import { formatBRL } from '../utils/format';
import { parseApiError } from '../utils/parseApiError';

export function CorrectClientBalanceModal({ client, hasDebt, onClose, onSuccess }: {
  client: ClientResponseDTO;
  hasDebt: boolean;
  onClose: () => void;
  onSuccess: (balance: number) => void;
}) {
  const { http } = useAuth();
  const { notify } = useNotification();
  const [expectedBalance] = useState(() => Math.max(0, client.balance ?? 0));
  const [amount, setAmount] = useState(() => expectedBalance.toFixed(2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!http || busy.current || hasDebt) return;

    busy.current = true;
    setSaving(true);
    setError('');
    try {
      const payload: ClientBalanceUpdateDTO = { balance: Number(amount), expectedBalance };
      const { data } = await http.patch<number>(`/clients/${client.id}/balance`, payload);
      notify('Saldo do cliente corrigido.', 'success');
      onSuccess(data);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal open title="Corrigir saldo" onClose={() => { if (!busy.current) onClose(); }} maxWidth="max-w-lg">
      <form onSubmit={submit} className="space-y-4 overflow-y-auto p-6">
        <p className="text-sm text-slate-600">{client.name} · Saldo atual <strong>{formatBRL(expectedBalance)}</strong></p>
        {hasDebt ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Há fiado em aberto. Para corrigir a dívida, abra o pedido correspondente na ficha do cliente.</p>
        ) : (
          <>
            <label className="block text-sm font-medium text-slate-700">
              Novo saldo (R$)
              <input
                autoFocus required disabled={saving} type="number" min="0" max="99999999.99" step="0.01"
                value={amount} onChange={event => setAmount(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <p className="text-sm text-slate-600">Informe o valor final do crédito. Use R$ 0,00 para zerar. Esta correção é feita fora do Caixa do Dia.</p>
          </>
        )}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm">
            {hasDebt ? 'Fechar' : 'Cancelar'}
          </button>
          {!hasDebt && (
            <button type="submit" disabled={saving || Number(amount) === expectedBalance} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar saldo'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
