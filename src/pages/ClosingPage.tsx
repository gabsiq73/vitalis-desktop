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
  { key: 'withdrawals', label: 'Retirada' },
  { key: 'dailyBalance', label: 'Saldo do dia' }, { key: 'accumulatedBalance', label: 'Saldo do mês' },
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
  const selectClass = 'min-h-11 px-3 py-2.5 border border-slate-200 rounded-lg bg-white text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary';
  return <div className="flex flex-col min-h-screen bg-background">
    <TopBar title="Fechamento" subtitle="Lucro do depósito por dia e por mês" />
    <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <span aria-hidden="true" className="material-symbols-outlined hidden sm:flex h-11 w-11 items-center justify-center rounded-lg bg-primary/5 text-primary">calendar_month</span>
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
        <button className={`${selectClass} ml-auto inline-flex items-center gap-2 hover:bg-slate-50 disabled:opacity-50`} disabled={loading} onClick={() => setRefresh(v => v + 1)}><span aria-hidden="true" className="material-symbols-outlined text-lg">refresh</span>Atualizar</button>
      </div>
      {loading && <p role="status" className="p-8 text-center text-slate-500">Carregando fechamento…</p>}
      {error && <div role="alert" className="p-4 rounded-lg bg-red-50 text-red-700 text-sm">{error}<button className="ml-3 underline font-semibold" onClick={() => setRefresh(v => v + 1)}>Tentar de novo</button></div>}
      {report && <>
        <section aria-labelledby="closing-daily-title" className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 border-t-4 border-t-primary bg-slate-50/60 px-5 py-5">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="material-symbols-outlined flex h-10 w-10 items-center justify-center rounded-lg border border-primary/10 bg-white text-primary">table_chart</span>
              <h2 id="closing-daily-title" className="font-semibold text-slate-900">{closingTitle(report.month, report.movementDays)}</h2>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">Valores em R$</span>
          </div>
          {report.days.length === 0 ? <div className="flex flex-col items-center gap-3 px-6 py-14 text-center"><span aria-hidden="true" className="material-symbols-outlined text-4xl text-slate-400">event_busy</span><p className="text-sm text-slate-500">Nenhum movimento de fechamento neste mês. Selecione outro mês para consultar.</p></div> :
            <div role="region" aria-label="Movimento diário do fechamento" tabIndex={0} className="overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"><table className="w-full min-w-[980px] text-sm whitespace-nowrap">
              <caption className="sr-only">Lucro diário e saldo acumulado em reais</caption>
              <thead className="text-xs">
                <tr className="border-b border-slate-200">
                  <th scope="col" rowSpan={2} className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">Data</th>
                  <th scope="colgroup" colSpan={2} className="border-r border-slate-200 bg-blue-50/70 px-4 py-2.5 text-center font-semibold uppercase tracking-wider text-primary">Vendas</th>
                  <th scope="colgroup" colSpan={3} className="border-r border-slate-200 bg-slate-50 px-4 py-2.5 text-center font-semibold uppercase tracking-wider text-slate-600">Saídas</th>
                  <th scope="colgroup" colSpan={2} className="bg-teal/5 px-4 py-2.5 text-center font-semibold uppercase tracking-wider text-teal-dim">Resultado</th>
                </tr>
                <tr className="border-b border-slate-200">{columns.map(c => <th scope="col" className={`px-4 py-3 text-right font-semibold ${c.key === 'dailyBalance' || c.key === 'accumulatedBalance' ? 'bg-teal/5 text-teal-dim' : 'bg-slate-50 text-slate-600'} ${c.key === 'gasProfit' || c.key === 'withdrawals' ? 'border-r border-slate-200' : ''}`} key={c.key}>{c.label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">{report.days.map((day, index) => <tr key={day.date} className="group hover:bg-blue-50/50">
                <th scope="row" className={`sticky left-0 z-10 border-r border-slate-100 px-4 py-4 text-left font-medium text-slate-700 group-hover:bg-blue-50 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>{day.date.split('-').reverse().join('/')}</th>
                {columns.map(c => <td key={c.key} className={`px-4 py-4 text-right tabular-nums ${c.key === 'gasProfit' || c.key === 'withdrawals' ? 'border-r border-slate-100' : ''} ${c.key === 'accumulatedBalance' ? 'bg-primary/5 font-bold' : c.key === 'dailyBalance' ? 'font-semibold' : index % 2 !== 0 ? 'bg-slate-50/50' : ''} ${day[c.key] < 0 ? 'text-red-700' : c.key === 'accumulatedBalance' ? 'text-primary' : c.key === 'dailyBalance' ? 'text-teal-dim' : 'text-slate-700'}`}>{formatBRL(day[c.key])}</td>)}
              </tr>)}</tbody>
              <tfoot className="border-t-2 border-slate-700 bg-slate-900 font-bold text-white"><tr><th scope="row" className="sticky left-0 z-10 bg-slate-900 px-4 py-5 text-left">Totais do mês</th>{columns.map(c => <td key={c.key} className={`px-4 py-5 text-right tabular-nums ${c.key === 'accumulatedBalance' ? 'bg-primary' : ''} ${report.totals[c.key] < 0 ? 'text-rose-200' : ''}`}>{formatBRL(report.totals[c.key])}</td>)}</tr></tfoot>
            </table></div>}
        </section>
        <section aria-labelledby="closing-summary-title" className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-5"><span aria-hidden="true" className="material-symbols-outlined flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5 text-primary">account_balance_wallet</span><h2 id="closing-summary-title" className="font-semibold text-slate-900">Quadro de fechamento do mês</h2></div>
          <table className="w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="px-5 py-3 text-left font-semibold" scope="col">Resultado</th><th className="px-5 py-3 text-right font-semibold" scope="col">Valor em R$</th><th className="px-5 py-3 text-right font-semibold" scope="col">% sobre faturamento</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{[
              { label: 'Faturamento', metric: report.summary.revenue, icon: 'payments', result: false },
              { label: 'Compras', metric: report.summary.purchases, icon: 'shopping_bag', result: false },
              { label: 'Despesas', metric: report.summary.expenses, icon: 'receipt_long', result: false },
              { label: 'Margem de lucro', metric: report.summary.profitMargin, icon: 'account_balance', result: true },
            ].map(row => <tr key={row.label} className={row.result ? 'bg-primary/5' : 'hover:bg-slate-50'}>
              <th scope="row" className={`px-5 py-4 text-left font-semibold ${row.result ? 'text-primary' : 'text-slate-700'}`}><span className="flex items-center gap-3"><span aria-hidden="true" className={`material-symbols-outlined text-xl ${row.result ? 'text-primary' : 'text-slate-500'}`}>{row.icon}</span>{row.label}</span></th>
              <td className={`px-5 py-4 text-right font-bold tabular-nums ${row.metric.value < 0 ? 'text-red-700' : row.result ? 'text-primary text-lg' : 'text-slate-900'}`}>{formatBRL(row.metric.value)}</td>
              <td className="px-5 py-4 text-right tabular-nums"><span className={`inline-block min-w-20 rounded-md px-2.5 py-1 text-xs font-semibold ${row.metric.percentage !== null && row.metric.percentage < 0 ? 'bg-red-50 text-red-700' : row.result ? 'bg-white text-primary' : 'bg-slate-100 text-slate-600'}`}>{formatClosingPercentage(row.metric.percentage)}</span></td>
            </tr>)}</tbody>
          </table>
        </section>
      </>}
    </main>
  </div>;
}
