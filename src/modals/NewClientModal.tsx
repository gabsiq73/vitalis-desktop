import { useState, useEffect, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import type { ClientResponseDTO, ClientRequestBody, ClientType, ClientStatus } from '../types';

interface NewClientModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (client: ClientResponseDTO) => void;
  client?: ClientResponseDTO;
}

const EMPTY_FORM: ClientRequestBody = {
  name: '',
  phone: '',
  address: '',
  notes: '',
  clientType: 'RETAIL',
  clientStatus: 'PAID',
};

function parseApiError(err: unknown): string {
  if (!isAxiosError(err)) return 'Erro de conexão. Verifique se o servidor está rodando.';
  const status = err.response?.status;
  const data = err.response?.data;
  if (status === 400 && typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.errors) && d.errors.length > 0) {
      const first = d.errors[0] as Record<string, unknown>;
      if (typeof first.message === 'string') return first.message;
    }
    if (typeof d.message === 'string') return d.message;
    return 'Dados inválidos. Verifique os campos obrigatórios.';
  }
  return `Erro no servidor (${status ?? 'desconhecido'}). Tente novamente.`;
}

export function NewClientModal({ open, onClose, onSuccess, client }: NewClientModalProps) {
  const { http } = useAuth();
  const isEdit = client !== undefined;
  const [form, setForm] = useState<ClientRequestBody>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      if (client) {
        setForm({
          name: client.name,
          phone: client.phone ?? '',
          address: client.address ?? '',
          notes: '',
          clientType: client.clientType,
          clientStatus: client.clientStatus,
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [open, client]);

  function set<K extends keyof ClientRequestBody>(key: K, value: ClientRequestBody[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!http) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        clientType: form.clientType,
        clientStatus: form.clientStatus,
      };
      if (form.phone.trim()) body.phone = form.phone.trim();
      if (form.address.trim()) body.address = form.address.trim();
      if (form.notes.trim().length >= 5) body.notes = form.notes.trim();

      if (isEdit) {
        await http.put(`/clients/${client.id}`, body);
        const updated = await http.get<ClientResponseDTO>(`/clients/${client.id}`);
        onSuccess(updated.data);
      } else {
        const res = await http.post<ClientResponseDTO>('/clients', body);
        onSuccess(res.data);
      }
      onClose();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'w-full border border-outline-variant rounded-lg bg-surface-container-low text-body-md py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';

  const labelClass = 'block text-label-sm text-on-surface-variant mb-1';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar Cliente' : 'Novo Cliente'}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-3 bg-error-container text-on-error-container rounded-lg">
            <span className="material-symbols-outlined text-error flex-shrink-0" style={{ fontSize: '18px' }}>
              error
            </span>
            <span className="text-label-sm">{error}</span>
          </div>
        )}

        <div>
          <label className={labelClass}>Nome *</label>
          <input
            required
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Nome completo ou razão social"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Telefone</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="(00) 00000-0000"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Tipo de Cliente *</label>
            <select
              required
              value={form.clientType}
              onChange={(e) => set('clientType', e.target.value as ClientType)}
              className={inputClass}
            >
              <option value="RETAIL">Varejo (RETAIL)</option>
              <option value="RESELLER">Revendedor (RESELLER)</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Endereço</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder="Rua, número, bairro, cidade"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Anotações</label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Informações adicionais sobre o cliente..."
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </div>

        {isEdit && (
          <div>
            <label className={labelClass}>Status Financeiro</label>
            <select
              value={form.clientStatus}
              onChange={(e) => set('clientStatus', e.target.value as ClientStatus)}
              className={inputClass}
            >
              <option value="PAID">Em dia (PAID)</option>
              <option value="OVERDUE">Inadimplente (OVERDUE)</option>
            </select>
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2 border-t border-outline-variant">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-6 py-2.5 border border-outline-variant rounded-lg font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-primary text-on-primary rounded-lg font-bold hover:brightness-110 transition-all disabled:opacity-70"
          >
            {submitting ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Criar Cliente'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
