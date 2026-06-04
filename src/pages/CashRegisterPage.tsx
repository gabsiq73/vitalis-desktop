import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { DailyCashPaymentDTO, DailyReportDTO, FinancialReportDTO } from '../types';
import { formatBRL } from '../utils/format';

const METHOD_LABEL: Record<string, string> = {
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
  SALDO: 'Saldo',
};

const METHOD_COLORS: Record<string, { bg: string; text: string; dot: string; hex: string }> = {
  PIX:      { bg: 'bg-teal/10',    text: 'text-teal',    dot: 'bg-teal',    hex: '#0d9488' },
  DINHEIRO: { bg: 'bg-green-100',  text: 'text-green-700', dot: 'bg-green-500', hex: '#22c55e' },
  SALDO:    { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500', hex: '#8b5cf6' },
};

function toLocalDateParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function CashRegisterPage() {
  const { http } = useAuth();
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState<string>(toLocalDateParam(new Date()));
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<DailyCashPaymentDTO[]>([]);
  const [operational, setOperational] = useState<DailyReportDTO | null>(null);
  const [financial, setFinancial] = useState<FinancialReportDTO | null>(null);

  const fetchData = useCallback(async () => {
    if (!http) return;
    setLoading(true);
    try {
      const [paymentsRes, operationalRes, financialRes] = await Promise.allSettled([
        http.get<DailyCashPaymentDTO[]>('/payments/daily', { params: { date: selectedDate } }),
        http.get<DailyReportDTO>('/reports/operational', { params: { start: selectedDate, end: selectedDate } }),
        http.get<FinancialReportDTO>('/reports/performance/daily', { params: { date: selectedDate } }),
      ]);
      if (paymentsRes.status === 'fulfilled') setPayments(paymentsRes.value.data ?? []);
      if (operationalRes.status === 'fulfilled') setOperational(operationalRes.value.data);
      if (financialRes.status === 'fulfilled') setFinancial(financialRes.value.data);
    } finally {
      setLoading(false);
    }
  }, [http, selectedDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isToday = selectedDate === toLocalDateParam(new Date());

  const faturado   = financial?.totalInvoiced ?? 0;
  const recebido   = financial?.totalReceived ?? 0;
  const saldoCaixa = financial?.getBalance ?? 0;
  const pix        = operational?.totalPix ?? 0;
  const dinheiro   = operational?.totalCash ?? 0;
  const saldoUsado = operational?.totalBalanceUsed ?? 0;
  const fiado      = operational?.totalDebt ?? 0;

  const pieData = [
    { name: 'PIX',      value: pix,        color: '#0d9488' },
    { name: 'Dinheiro', value: dinheiro,    color: '#22c55e' },
    { name: 'Saldo',    value: saldoUsado,  color: '#8b5cf6' },
  ].filter(d => d.value > 0);

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
              onChange={e => setSelectedDate(e.target.value)}
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
            className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>refresh</span>
            Atualizar
          </button>
        </div>

        {/* Summary banner */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary via-teal to-green-400" />
          <div className="px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Faturado', value: faturado, color: 'text-slate-800', icon: 'receipt_long' },
              { label: 'Recebido', value: recebido, color: 'text-teal', icon: 'check_circle' },
              { label: 'Saldo do Caixa', value: saldoCaixa, color: saldoCaixa >= 0 ? 'text-primary' : 'text-red-600', icon: 'account_balance_wallet' },
              { label: 'Fiado (Em Aberto)', value: fiado, color: fiado > 0 ? 'text-orange-500' : 'text-slate-400', icon: 'schedule' },
            ].map((item, i) => (
              <div key={item.label} className={`flex items-start gap-3 ${i < 3 ? 'md:border-r md:border-slate-100 md:pr-6' : ''}`}>
                <div className="p-2 rounded-lg bg-slate-50 flex-shrink-0">
                  <span className={`material-symbols-outlined ${item.color}`} style={{ fontSize: '20px' }}>{item.icon}</span>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{item.label}</p>
                  <p className={`text-[22px] font-black leading-tight ${item.color}`}>
                    {loading ? '—' : formatBRL(item.value)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* KPI cards — by method */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'PIX',            value: pix,        icon: 'pix',         topColor: '#0d9488', badge: `${payments.filter(p => p.paymentMethod === 'PIX').length} mov.` },
            { label: 'Dinheiro',       value: dinheiro,   icon: 'payments',    topColor: '#22c55e', badge: `${payments.filter(p => p.paymentMethod === 'DINHEIRO').length} mov.` },
            { label: 'Saldo (Crédito)', value: saldoUsado, icon: 'account_balance', topColor: '#8b5cf6', badge: `${payments.filter(p => p.paymentMethod === 'SALDO').length} mov.` },
            { label: 'Fiado',          value: fiado,      icon: 'hourglass_empty', topColor: fiado > 0 ? '#f97316' : '#94a3b8', badge: fiado > 0 ? 'Pendente' : 'Zerado' },
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
                  {loading ? '—' : formatBRL(kpi.value)}
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
              <span className="text-[12px] text-slate-400">{loading ? '—' : `${payments.length} transações`}</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-7 h-7 border-3 border-primary border-t-transparent rounded-full animate-spin" />
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
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-5 py-3.5 text-[12px] text-slate-400 font-mono tabular-nums whitespace-nowrap">
                            {formatTime(p.paymentDate)}
                          </td>
                          <td className="px-4 py-3.5 text-[13px] font-medium text-slate-700 max-w-[180px] truncate">
                            {p.clientName}
                          </td>
                          <td className="px-4 py-3.5">
                            <button
                              onClick={() => navigate(`/orders/${p.orderId}`)}
                              className="font-mono text-[12px] text-primary hover:underline"
                            >
                              {p.orderRef}
                            </button>
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
                        Total recebido
                      </td>
                      <td className="px-5 py-3 text-right font-black text-[15px] text-teal tabular-nums">
                        {loading ? '—' : formatBRL(recebido)}
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
              <h2 className="text-[15px] font-bold text-slate-800 mb-4">Formas de Recebimento</h2>
              {loading || pieData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <span className="material-symbols-outlined mb-2" style={{ fontSize: '36px' }}>donut_large</span>
                  <p className="text-sm">Sem dados</p>
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
            </div>

            {/* Products sold */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-card p-5">
              <h2 className="text-[15px] font-bold text-slate-800 mb-4">Produtos Entregues</h2>
              <div className="space-y-3">
                {[
                  { label: 'Água (Recarga)', value: operational?.totalWaterSold ?? 0, icon: 'water_drop', color: 'text-blue-500', bg: 'bg-blue-50' },
                  { label: 'Gás (Botijões)', value: operational?.totalGasSold ?? 0, icon: 'local_fire_department', color: 'text-orange-500', bg: 'bg-orange-50' },
                  { label: 'Lucro do Gás', value: financial?.gasGrossProfit ?? 0, icon: 'trending_up', color: 'text-teal', bg: 'bg-teal/10', isCurrency: true },
                  { label: 'Crédito Gerado', value: operational?.totalCreditGenerated ?? 0, icon: 'account_balance', color: 'text-purple-600', bg: 'bg-purple-50', isCurrency: true },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0`}>
                      <span className={`material-symbols-outlined ${item.color}`} style={{ fontSize: '16px' }}>{item.icon}</span>
                    </div>
                    <span className="text-[13px] text-slate-600 flex-1">{item.label}</span>
                    <span className="text-[13px] font-bold text-slate-700">
                      {loading ? '—' : item.isCurrency ? formatBRL(item.value) : `${item.value} un`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

      </main>
    </div>
  );
}
