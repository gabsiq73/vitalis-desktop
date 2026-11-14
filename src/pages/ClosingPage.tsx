import { useEffect, useRef, useState } from 'react';
import { TopBar } from '../components/TopBar';
import { useAuth } from '../hooks/useAuth';
import { parseApiError } from '../utils/parseApiError';
import { formatBRL } from '../utils/format';
import { closingTitle, CLOSING_MONTHS, formatClosingPercentage } from '../utils/closing';
import type { ClosingValues, MonthlyClosingDTO } from '../types/closing';

const columns: { key: keyof ClosingValues; label: string }[] = [
  { key: 'waterProfit', label: 'Vendas água' }, { key: 'gasProfit', label: 'Vendas gás' },
  { key: 'purchases', label: 'Compras' }, { key: 'expenses', label: 'Despesas' },
  { key: 'dailyBalance', label: 'Saldo do dia' }, { key: 'accumulatedBalance', label: 'Saldo do mês' },
  { key: 'withdrawals', label: 'Retirada' },
];

export function ClosingPage() {
  const { http } = useAuth();
  const [period, setPeriod] = useState(() => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
    return { year: Number(parts.find(p => p.type === 'year')!.value), month: Number(parts.find(p => p.type === 'month')!.value) };
  });
  const [report, setReport] = useState<MonthlyClosingDTO | null>(null);
  const [yearInput, setYearInput] = useState(() => String(period.year));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const requestId = useRef(0);
  useEffect(() => {
    if (!http) return;
    const id = ++requestId.current;
    const controller = new AbortController();
    setLoading(true); setError(''); setReport(null);
    http.get<MonthlyClosingDTO>('/reports/closing', { params: period, signal: controller.signal })
      .then(response => { if (!controller.signal.aborted && id === requestId.current) setReport(response.data); })
      .catch(err => { if (!controller.signal.aborted && id === requestId.current) setError(parseApiError(err)); })
      .finally(() => { if (!controller.signal.aborted && id === requestId.current) setLoading(false); });
    return () => controller.abort();
  }, [http, period, refresh]);
  const selectClass = 'px-3 py-2.5 border border-slate-200 rounded-lg bg-white text-sm text-slate-700 focus:ring-2 focus:ring-primary/20';
  return <div className="flex flex-col min-h-screen bg-background">
    <TopBar title="Fechamento" subtitle="Lucro do depósito por dia e por mês" />
    <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-700 flex flex-col gap-1">Mês
          <select aria-label="Mês" className={selectClass} value={period.month} onChange={e => setPeriod(p => ({ ...p, month: Number(e.target.value) }))}>
            {CLOSING_MONTHS.map((month, i) => <option key={month} value={i + 1}>{month}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-700 flex flex-col gap-1">Ano
          <input aria-label="Ano" className={`${selectClass} w-28`} type="number" min="1900" max="9999" value={yearInput}
            onChange={e => setYearInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            onBlur={() => { const year = Number(yearInput); if (Number.isInteger(year) && year >= 1900 && year <= 9999) setPeriod(p => p.year === year ? p : ({ ...p, year })); else setYearInput(String(period.year)); }} />
        </label>
        <button className={`${selectClass} ml-auto disabled:opacity-50`} disabled={loading} onClick={() => setRefresh(v => v + 1)}>Atualizar</button>
      </div>
      <p className="text-sm text-slate-600">O fechamento conta o dinheiro no dia em que é recebido; fiado só entra quando pago. As colunas de vendas mostram lucro, não faturamento. Retirada é apenas informativa.</p>
      {loading && <p role="status" className="p-8 text-center text-slate-500">Carregando fechamento…</p>}
      {error && <div role="alert" className="p-4 rounded-lg bg-red-50 text-red-700 text-sm">{error}<button className="ml-3 underline font-semibold" onClick={() => setRefresh(v => v + 1)}>Tentar de novo</button></div>}
      {report && <>
        <section className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
          <h2 className="p-5 font-semibold text-slate-800 border-b border-slate-100">{closingTitle(report.month, report.movementDays)}</h2>
          {report.days.length === 0 ? <p className="p-10 text-center text-slate-500">Nenhum movimento de fechamento neste mês. Selecione outro mês para consultar.</p> :
            <div className="overflow-x-auto"><table className="w-full text-sm whitespace-nowrap">
              <caption className="sr-only">Lucro diário e saldo acumulado em reais</caption>
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th scope="col" className="px-4 py-3 text-left">Data</th>{columns.map(c => <th scope="col" className="px-4 py-3 text-right" key={c.key}>{c.label}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">{report.days.map(day => <tr key={day.date} className="hover:bg-slate-50">
                <th scope="row" className="px-4 py-4 text-left font-medium text-slate-700">{day.date.split('-').reverse().join('/')}</th>
                {columns.map(c => <td key={c.key} className={`px-4 py-4 text-right tabular-nums ${day[c.key] < 0 ? 'text-red-700' : 'text-slate-700'}`}>{formatBRL(day[c.key])}</td>)}
              </tr>)}</tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200 font-bold"><tr><th scope="row" className="px-4 py-4 text-left">Totais do mês</th>{columns.map(c => <td key={c.key} className={`px-4 py-4 text-right tabular-nums ${report.totals[c.key] < 0 ? 'text-red-700' : 'text-slate-800'}`}>{formatBRL(report.totals[c.key])}</td>)}</tr></tfoot>
            </table></div>}
        </section>
        <section className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden max-w-3xl">
          <h2 className="p-5 font-semibold text-slate-800">Quadro de fechamento do mês</h2>
          <table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-5 py-3 text-left" scope="col">Resultado</th><th className="px-5 py-3 text-right" scope="col">Valor em R$</th><th className="px-5 py-3 text-right" scope="col">% sobre faturamento</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{[
              { label: 'Faturamento', metric: report.summary.revenue, color: 'text-green-700', bg: 'bg-green-50' },
              { label: 'Compras', metric: report.summary.purchases, color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'Despesas', metric: report.summary.expenses, color: 'text-red-700', bg: 'bg-red-50' },
              { label: 'Margem de lucro', metric: report.summary.profitMargin, color: report.summary.profitMargin.value < 0 ? 'text-red-700' : 'text-orange-700', bg: 'bg-orange-50' },
            ].map(row => <tr key={row.label} className={row.bg}><th scope="row" className={`px-5 py-4 text-left font-semibold ${row.color}`}>{row.label}</th><td className={`px-5 py-4 text-right font-bold tabular-nums ${row.color}`}>{formatBRL(row.metric.value)}</td><td className={`px-5 py-4 text-right tabular-nums ${row.color}`}>{formatClosingPercentage(row.metric.percentage)}</td></tr>)}</tbody>
          </table>
        </section>
        {report.warnings.length > 0 && <aside aria-label="Observações do fechamento" className="p-4 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-900"><h2 className="font-semibold mb-2">Observações deste mês</h2><ul className="list-disc pl-5 space-y-1">{report.warnings.map(w => <li key={w}>{w}</li>)}</ul></aside>}
      </>}
    </main>
  </div>;
}
