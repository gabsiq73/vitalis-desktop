import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { DailyCashPaymentDTO, DailyReportDTO, FinancialReportDTO, CashMovementType } from '../types';
import { formatBRL, formatTime } from '../utils/format';
import { dailyCashTotals } from '../utils/dailyCashTotals';
import { parseApiError, cashMovementApiError } from '../utils/parseApiError';
import { CashMovementModal } from '../modals/CashMovementModal';
import { cashMovementDirection } from '../utils/cashMovement';

const METHOD_LABEL: Record<string, string> = {
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
  SALDO: 'Crédito utilizado',
};

const METHOD_COLORS: Record<string, { bg: string; text: string; dot: string; hex: string }> = {
  PIX:      { bg: 'bg-teal/10',    text: 'text-teal',    dot: 'bg-teal',    hex: '#0d9488' },
  DINHEIRO: { bg: 'bg-green-100',  text: 'text-green-700', dot: 'bg-green-500', hex: '#22c55e' },
  SALDO:    { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500', hex: '#8b5cf6' },
};

function toLocalDateParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function CashRegisterPage() {
  const { http } = useAuth();
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState<string>(toLocalDateParam(new Date()));
  const [fetching, setLoading] = useState(true);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const requestId = useRef(0);
  const loading = fetching || loadedDate !== selectedDate;
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [payments, setPayments] = useState<DailyCashPaymentDTO[]>([]);
  const [operational, setOperational] = useState<DailyReportDTO | null>(null);
  const [financial, setFinancial] = useState<FinancialReportDTO | null>(null);
  const [financialError, setFinancialError] = useState<string | null>(null);
  const [movementType, setMovementType] = useState<CashMovementType | null>(null);

  const fetchData = useCallback(async () => {
    if (!http) return;
    const currentRequest = ++requestId.current;
    setLoading(true);
    setPayments([]);
    setPaymentsError(null);
    setOperational(null);
    setFinancial(null);
    setFinancialError(null);
    try {
      const [paymentsRes, operationalRes, financialRes] = await Promise.allSettled([
        http.get<DailyCashPaymentDTO[]>('/payments/daily', { params: { date: selectedDate, includeBalance: true } }),
        http.get<DailyReportDTO>('/reports/operational', { params: { start: selectedDate, end: selectedDate } }),
        http.get<FinancialReportDTO>('/reports/performance/daily', { params: { date: selectedDate } }),
      ]);
      if (currentRequest !== requestId.current) return;
      if (paymentsRes.status === 'fulfilled') setPayments(paymentsRes.value.data ?? []);
      else setPaymentsError(parseApiError(paymentsRes.reason));
      if (operationalRes.status === 'fulfilled') setOperational(operationalRes.value.data);
      if (financialRes.status === 'fulfilled') setFinancial(financialRes.value.data);
      else setFinancialError(cashMovementApiError(financialRes.reason));
    } finally {
      if (currentRequest === requestId.current) {
        setLoadedDate(selectedDate);
        setLoading(false);
      }
    }
  }, [http, selectedDate]);

  useEffect(() => {
    fetchData();
    return () => { requestId.current += 1; };
  }, [fetchData]);

  const isToday = selectedDate === toLocalDateParam(new Date());

  const totals = dailyCashTotals(payments);
  const faturado   = financial?.totalInvoiced;
  const recebido   = financial?.totalReceived;
  const saldoCaixa = financial?.finalBalance;
  const pix        = paymentsError ? undefined : totals.PIX.amount;
  const dinheiro   = paymentsError ? undefined : totals.DINHEIRO.amount;
  const saldoUsado = paymentsError ? undefined : totals.SALDO.amount;
  const fiado      = operational?.totalDebt;
  const displayAmount = (value: number | undefined) => loading ? '—' : value === undefined ? 'Indisponível' : formatBRL(value);
  const movementCount = (count: number) => loading ? '—' : paymentsError ? 'Indisponível' : `${count} mov.`;

  const pieData = [
    { name: 'PIX',      value: pix ?? 0,        color: '#0d9488' },
    { name: 'Dinheiro', value: dinheiro ?? 0,    color: '#22c55e' },
  ].filter(d => d.value > 0);

  const ledgerRows = [
    ...(financial?.cashMovements ?? []).map(movement => ({
      ...movement, direction: cashMovementDirection(movement), key: `manual-${movement.id}`,
      label: { ENTRY: 'Entrada manual', WITHDRAWAL: 'Retirada', ADJUSTMENT: 'Ajuste' }[movement.type],
    })),
    ...(financial?.gasSettlementMovements ?? []).map(settlement => ({
      key: `gas-${settlement.id}`, occurredAt: settlement.settledDate, direction: settlement.direction,
      amount: settlement.amount, label: settlement.type === 'SUPPLIER_OWE' ? 'Comissão de gás' : 'Repasse de gás',
      note: `Fornecedor: ${settlement.supplierName}`,
    })),
  ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar title="Caixa do Dia" subtitle="Movimentações financeiras e fechamento de caixa" />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">

        {/* Date picker + refresh */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
            <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '18px' }}>calendar_today</span>
            <input
              type="date"
              value={selectedDate}
              onChange={e => { if (e.target.value && e.target.value !== selectedDate) { requestId.current += 1; setMovementType(null); setSelectedDate(e.target.value); } }}
              className="text-sm font-medium text-slate-700 bg-transparent outline-none cursor-pointer"
            />
          </div>
          {isToday && (
            <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-wide">
              Hoje
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>refresh</span>
            Atualizar
          </button>
        </div>

        {/* Summary banner */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary via-teal to-green-400" />
          <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { label: 'Vendas entregues (valor bruto)', value: faturado, color: 'text-slate-800', icon: 'receipt_long' },
              { label: 'Recebido no depósito', value: recebido, color: 'text-teal', icon: 'check_circle' },
              { label: 'Saldo do Caixa', value: saldoCaixa, color: (saldoCaixa ?? 0) >= 0 ? 'text-primary' : 'text-red-600', icon: 'account_balance_wallet' },
            ].map((item, i) => (
              <div key={item.label} className={`flex items-start gap-3 ${i < 2 ? 'md:border-r md:border-slate-100 md:pr-6' : ''}`}>
                <div className="p-2 rounded-lg bg-slate-50 flex-shrink-0">
                  <span className={`material-symbols-outlined ${item.color}`} style={{ fontSize: '20px' }}>{item.icon}</span>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{item.label}</p>
                  <p className={`text-[22px] font-black leading-tight ${item.color}`}>
                    {displayAmount(item.value)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* KPI cards — by method */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'PIX',            value: pix,        icon: 'pix',         topColor: '#0d9488', badge: movementCount(totals.PIX.count) },
            { label: 'Dinheiro',       value: dinheiro,   icon: 'payments',    topColor: '#22c55e', badge: movementCount(totals.DINHEIRO.count) },
            { label: 'Crédito utilizado', value: saldoUsado, icon: 'account_balance', topColor: '#8b5cf6', badge: movementCount(totals.SALDO.count) },
            { label: 'Fiado do dia (pedidos entregues em aberto)', value: fiado,      icon: 'hourglass_empty', topColor: (fiado ?? 0) > 0 ? '#f97316' : '#94a3b8', badge: loading ? '—' : fiado === undefined ? 'Indisponível' : fiado > 0 ? 'Pendente' : 'Zerado' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: kpi.topColor }} />
              <div className="p-5 pt-6">
                <div className="flex items-start justify-between mb-2">
                  <span className="material-symbols-outlined text-slate-300" style={{ fontSize: '26px' }}>{kpi.icon}</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{kpi.badge}</span>
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1">{kpi.label}</p>
                <p className="text-[24px] font-black text-slate-800 leading-none">
                  {displayAmount(kpi.value)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Transactions + chart */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Transactions table */}
          <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-slate-800">Movimentações</h2>
              <span className="text-[12px] text-slate-400">{loading ? '—' : paymentsError ? 'Indisponível' : `${payments.length} transações`}</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-7 h-7 border-3 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : paymentsError ? (
              <div role="alert" className="px-5 py-10 text-sm text-red-600">
                Movimentações indisponíveis para a data selecionada. {paymentsError} Use Atualizar para tentar novamente.
              </div>
            ) : payments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <span className="material-symbols-outlined mb-2" style={{ fontSize: '40px' }}>point_of_sale</span>
                <p className="text-sm font-medium">Nenhuma movimentação nesta data</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Horário</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pedido</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Método</th>
                      <th className="text-right px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {payments.map(p => {
                      const m = METHOD_COLORS[p.paymentMethod] ?? { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', hex: '#94a3b8' };
                      const orderId = typeof p.orderId === 'string' ? p.orderId.trim() : '';
                      const hasOrder = orderId !== '' && orderId !== 'null' && orderId !== 'undefined';
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-5 py-3.5 text-[12px] text-slate-400 font-mono tabular-nums whitespace-nowrap">
                            {formatTime(p.paymentDate)}
                          </td>
                          <td className="px-4 py-3.5 text-[13px] font-medium text-slate-700 max-w-[180px] truncate">
                            {p.clientName}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-col items-start gap-1">
                              {p.entryType === 'CLIENT_CREDIT' && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700">
                                  Crédito gerado
                                </span>
                              )}
                              {hasOrder ? (
                                <button
                                  onClick={() => navigate(`/orders/${orderId}`)}
                                  aria-label={`Abrir pedido ${p.orderRef}`}
                                  className="font-mono text-[12px] text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded"
                                >
                                  {p.orderRef}
                                </button>
                              ) : (
                                <span className="text-[12px] text-slate-500">Sem pedido vinculado</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${m.bg} ${m.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
                              {METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-[14px] text-slate-800 tabular-nums whitespace-nowrap">
                            {formatBRL(p.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-200">
                      <td colSpan={4} className="px-5 py-3 text-[12px] font-semibold text-slate-500 uppercase tracking-wide">
                        Novas entradas (PIX + Dinheiro)
                      </td>
                      <td className="px-5 py-3 text-right font-black text-[15px] text-teal tabular-nums">
                        {formatBRL(totals.newReceipts)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-4">

            {/* Donut chart */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-card p-5">
              <h2 className="text-[15px] font-bold text-slate-800 mb-2">Novas entradas</h2>
              <p className="text-xs text-slate-500 mb-4">PIX e Dinheiro, incluindo crédito gerado.</p>
              {loading || pieData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <span className="material-symbols-outlined mb-2" style={{ fontSize: '36px' }}>donut_large</span>
                  <p className="text-sm">{loading ? 'Carregando…' : paymentsError ? 'Recebimentos indisponíveis' : 'Nenhuma nova entrada nesta data'}</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value" paddingAngle={2}>
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e5ef', fontSize: '12px' }}
                        formatter={(v) => [formatBRL(Number(v ?? 0)), '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-2">
                    {pieData.map(d => (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                          <span className="text-[13px] text-slate-600">{d.name}</span>
                        </div>
                        <span className="text-[13px] font-bold text-slate-700">{formatBRL(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="mt-4 pt-3 border-t border-slate-100 text-[13px] text-purple-700">
                <div className="flex justify-between gap-2">
                  <span>Crédito utilizado (SALDO)</span>
                  <span className="font-bold">{displayAmount(saldoUsado)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Consumo de crédito existente; não compõe novas entradas.</p>
              </div>
            </div>

            {/* Products sold */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-card p-5">
              <h2 className="text-[15px] font-bold text-slate-800 mb-4">Produtos Entregues</h2>
              <div className="space-y-3">
                {[
                  { label: 'Água (Recarga)', value: operational?.totalWaterSold, icon: 'water_drop', color: 'text-blue-500', bg: 'bg-blue-50' },
                  { label: 'Gás (Botijões)', value: operational?.totalGasSold, icon: 'local_fire_department', color: 'text-orange-500', bg: 'bg-orange-50' },
                  { label: 'Margem do gás entregue', value: financial?.gasGrossProfit, icon: 'trending_up', color: 'text-teal', bg: 'bg-teal/10', isCurrency: true },
                  { label: 'Crédito Gerado', value: operational?.totalCreditGenerated, icon: 'account_balance', color: 'text-purple-600', bg: 'bg-purple-50', isCurrency: true },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0`}>
                      <span className={`material-symbols-outlined ${item.color}`} style={{ fontSize: '16px' }}>{item.icon}</span>
                    </div>
                    <span className="text-[13px] text-slate-600 flex-1">{item.label}</span>
                    <span className="text-[13px] font-bold text-slate-700">
                      {loading ? '—' : item.value === undefined ? 'Indisponível' : item.isCurrency ? formatBRL(item.value) : `${item.value} un`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        <section className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden" aria-labelledby="ledger-title">
          <div className="px-5 py-4 border-b border-slate-100 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="ledger-title" className="text-[15px] font-bold text-slate-800">Livro-caixa do dia</h2>
              <div className="flex flex-wrap gap-2">
                {([
                  { type: 'ENTRY', label: 'Registrar entrada' },
                  { type: 'WITHDRAWAL', label: 'Registrar retirada' },
                  { type: 'ADJUSTMENT', label: 'Ajustar caixa' },
                ] as const).map(action => (
                  <button key={action.type} disabled={loading || !financial} onClick={() => setMovementType(action.type)} className="px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 text-primary hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">{action.label}</button>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-500">Saldo do Caixa retornado pela API para a data selecionada: recebimentos PIX/Dinheiro + entradas + ajustes líquidos − retiradas + comissões de gás liquidadas − repasses de gás liquidados. Acertos já incluídos no saldo. Não representa apenas dinheiro físico nem saldo acumulado de outros dias.</p>
            {!loading && financial && <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
              <span>Entradas manuais: {formatBRL(financial.totalEntries)}</span>
              <span>Ajustes líquidos: {formatBRL(financial.totalAdjustments)}</span>
              <span>Retiradas: {formatBRL(financial.totalWithdrawals)}</span>
              <span>Comissões de gás: {formatBRL(financial.gasSettlementsIn)}</span>
              <span>Repasses de gás: {formatBRL(financial.gasSettlementsOut)}</span>
            </div>}
          </div>
          {loading ? <p className="p-6 text-sm text-slate-500">Carregando livro-caixa…</p>
            : financialError ? <p role="alert" className="p-6 text-sm text-red-600">Livro-caixa indisponível. {financialError} Use Atualizar para tentar novamente.</p>
            : ledgerRows.length === 0 ? <p className="p-6 text-sm text-slate-500">Nenhum movimento manual ou acerto de gás liquidado nesta data.</p>
            : <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-5 py-3">Horário</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Direção</th><th className="px-4 py-3">Motivo / origem</th><th className="px-5 py-3 text-right">Valor</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">{ledgerRows.map(row => <tr key={row.key}>
                  <td className="px-5 py-3 font-mono text-xs whitespace-nowrap">{formatTime(row.occurredAt)}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{row.label}</td>
                  <td className={`px-4 py-3 ${row.direction === 'IN' ? 'text-green-700' : row.direction === 'OUT' ? 'text-orange-700' : 'text-slate-500'}`}>{row.direction === 'IN' ? 'Entrada' : row.direction === 'OUT' ? 'Saída' : 'Não informada'}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-pre-wrap break-words max-w-sm">{row.note || '—'}</td>
                  <td className={`px-5 py-3 text-right font-bold whitespace-nowrap ${row.direction === 'IN' ? 'text-green-700' : row.direction === 'OUT' ? 'text-orange-700' : 'text-slate-500'}`}>{row.direction === 'IN' ? '+' : row.direction === 'OUT' ? '−' : ''} {formatBRL(row.amount)}</td>
                </tr>)}</tbody>
              </table>
            </div>}
        </section>
        {movementType && !loading && financial && <CashMovementModal type={movementType} date={selectedDate} balance={financial.finalBalance} onClose={() => setMovementType(null)} onSuccess={() => { setMovementType(null); fetchData(); }} />}

      </main>
    </div>
  );
}
