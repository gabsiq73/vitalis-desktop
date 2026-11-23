import { useEffect, useId, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { ClientResponseDTO, SpringPage } from '../types';
import { formatBRL, maskPhone } from '../utils/format';
import { parseApiError } from '../utils/parseApiError';

type ClientOption = Pick<ClientResponseDTO, 'id' | 'name'>;

interface Props {
  label: string;
  value: ClientOption | null;
  onChange: (client: ClientOption | null) => void;
  disabled?: boolean;
}

export function ClientPicker({ label, value, onChange, disabled }: Props) {
  const { http } = useAuth();
  const id = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ClientResponseDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const name = (value?.name ?? query).trim();

  useEffect(() => {
    if (!http || !open || disabled || name.length === 1) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      http.get<SpringPage<ClientResponseDTO>>('/clients', {
        signal: controller.signal,
        params: { size: 50, sort: 'name,asc', ...(name ? { name } : {}) },
      }).then(({ data }) => {
        if (!controller.signal.aborted) setResults(data.content);
      }).catch(err => {
        if (!controller.signal.aborted) setError(parseApiError(err));
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    }, name ? 350 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [http, open, name, disabled]);

  function beginSearch(term: string) {
    setResults([]);
    setError('');
    setLoading(term.trim().length !== 1);
    setOpen(true);
  }

  return (
    <div className="relative" onBlur={e => {
      if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
    }} onKeyDown={e => {
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    }}>
      <label htmlFor={id} className="block mb-1 text-sm text-on-surface-variant">{label}</label>
      <div className="relative">
        <span aria-hidden="true" className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: '18px' }}>search</span>
        <input
          id={id}
          type="text"
          autoComplete="off"
          disabled={disabled}
          value={value?.name ?? query}
          placeholder="Buscar cliente..."
          className="w-full py-2.5 pl-9 pr-10 border border-outline-variant rounded-lg bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          onFocus={() => { if (!open) beginSearch(name); }}
          onClick={() => { if (!open) beginSearch(name); }}
          onChange={e => {
            const next = e.target.value;
            setQuery(next);
            onChange(null);
            if (next.trim() !== name || !open) beginSearch(next);
          }}
        />
        {(value || query) && <button
          type="button"
          aria-label="Limpar cliente"
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-500 hover:bg-slate-100"
          onClick={() => {
            onChange(null);
            setQuery('');
            setOpen(false);
          }}
        ><span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span></button>}
      </div>
      {open && !disabled && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-lg border border-outline-variant bg-surface shadow-lg">
          {(loading || error || results.length === 0) && (
            <p role="status" className="px-4 py-3 text-sm text-on-surface-variant">
              {error || (loading ? 'Buscando...' : name.length === 1 ? 'Digite pelo menos dois caracteres.' : 'Nenhum cliente encontrado.')}
            </p>
          )}
          {results.map(client => (
            <button
              key={client.id}
              type="button"
              onClick={() => { onChange(client); setQuery(''); setOpen(false); }}
              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-surface-container focus:bg-surface-container"
            >
              <span>
                <span className="block text-sm font-semibold">{client.name}</span>
                <span className="block text-xs text-on-surface-variant">
                  {client.clientType === 'RESELLER' ? 'Revenda' : client.clientType === 'RETAIL' ? 'Varejo' : 'Avulso'}
                  {client.phone && ` · ${maskPhone(client.phone)}`}
                </span>
              </span>
              <span className={`text-xs font-bold ${client.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatBRL(client.balance)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
