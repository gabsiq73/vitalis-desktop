import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import { ConfirmModal } from '../components/ConfirmModal';
import { NewClientModal } from '../modals/NewClientModal';
import { NewOrderModal } from '../modals/NewOrderModal';
import { AddFidelityPointsModal } from '../modals/AddFidelityPointsModal';
import type {
  ClientResponseDTO,
  OrderResponseDTO,
  LoanedBottleResponseDTO,
  ProductResponseDTO,
  ClientPriceResponseDTO,
  ClientPriceRequestDTO,
  SpringPage,
  PaymentMethod,
} from '../types';
import {
  formatBRL,
  formatOrderId,
  formatDateTime,
  getInitials,
  getOrderStatusBadge,
  getPaymentStatusBadge,
} from '../utils/format';

type TabId = 'pedidos' | 'pagamentos' | 'precos' | 'fidelidade' | 'vasilhames';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'pedidos',    label: 'Pedidos',           icon: 'shopping_cart' },
  { id: 'pagamentos', label: 'Pag. em Lote',       icon: 'payments' },
  { id: 'precos',     label: 'Preços',             icon: 'sell' },
  { id: 'fidelidade', label: 'Fidelidade',         icon: 'workspace_premium' },
  { id: 'vasilhames', label: 'Vasilhames',         icon: 'propane_tank' },
];

const CLIENT_TYPE_LABEL: Record<string, string> = {
  RETAIL: 'Varejo',
  RESELLER: 'Revendedor',
  AVULSO: 'Avulso',
};

const inputClass =
  'w-full border border-slate-200 rounded-lg bg-slate-50 text-[13px] py-2.5 px-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { http } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<ClientResponseDTO | null>(null);
  const [orders, setOrders] = useState<OrderResponseDTO[]>([]);
  const [bottles, setBottles] = useState<LoanedBottleResponseDTO[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('pedidos');

  const [showEditClient, setShowEditClient] = useState(false);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [returnTarget, setReturnTarget] = useState<string | null>(null);
  const [showAddPoints, setShowAddPoints] = useState(false);

  const [bulkAmount, setBulkAmount] = useState('');
  const [bulkMethod, setBulkMethod] = useState<PaymentMethod>('PIX');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const [prices, setPrices] = useState<ClientPriceResponseDTO[]>([]);
  const [products, setProducts] = useState<ProductResponseDTO[]>([]);
  const [priceForm, setPriceForm] = useState<{ productId: string; customPrice: string }>({ productId: '', customPrice: '' });
  const [priceSubmitting, setPriceSubmitting] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  function fetchClient() {
    if (!http || !id) return;
    http.get<ClientResponseDTO>(`/clients/${id}`).then((r) => setClient(r.data)).catch(() => {});
  }
  function fetchOrders() {
    if (!http || !id) return;
    http.get<SpringPage<OrderResponseDTO>>(`/orders/client/${id}`, { params: { size: 50 } })
      .then((r) => setOrders(r.data.content)).catch(() => setOrders([]));
  }
  function fetchBottles() {
    if (!http || !id) return;
    http.get<SpringPage<LoanedBottleResponseDTO>>(`/bottles/client/${id}`, { params: { size: 50 } })
      .then((r) => setBottles(r.data.content)).catch(() => setBottles([]));
  }
  function fetchPrices() {
    if (!http || !id) return;
    http.get<ClientPriceResponseDTO[]>(`/clients/${id}/prices`).then((r) => setPrices(r.data)).catch(() => setPrices([]));
  }

  useEffect(() => {
    if (!http || !id) return;
    setLoading(true);
    Promise.all([
      http.get<ClientResponseDTO>(`/clients/${id}`),
      http.get<SpringPage<OrderResponseDTO>>(`/orders/client/${id}`, { params: { size: 50 } }),
      http.get<SpringPage<LoanedBottleResponseDTO>>(`/bottles/client/${id}`, { params: { size: 50 } }),
      http.get<ClientPriceResponseDTO[]>(`/clients/${id}/prices`),
      http.get<SpringPage<ProductResponseDTO>>('/products', { params: { size: 200 } }),
    ])
      .then(([cRes, oRes, bRes, pricRes, prodRes]) => {
        setClient(cRes.data);
        setOrders(oRes.data.content);
        setBottles(bRes.data.content);
        setPrices(pricRes.data);
        setProducts(prodRes.data.content.filter((p) => p.isActive));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [http, id]);

  async function registerReturn() {
    if (!http || !returnTarget) return;
    await http.patch(`/bottles/${returnTarget}/return`);
    fetchBottles();
  }

  async function handleBulkPayment() {
    if (!http || !id || !bulkAmount) return;
    setBulkSubmitting(true);
    setBulkError(null);
    setBulkSuccess(false);
    try {
      await http.post(`/payments/bulk/${id}`, null, {
        params: { amount: parseFloat(bulkAmount), method: bulkMethod },
      });
      setBulkSuccess(true);
      setBulkAmount('');
      fetchClient();
      fetchOrders();
    } catch {
      setBulkError('Erro ao processar pagamento. Tente novamente.');
    } finally {
      setBulkSubmitting(false);
    }
  }

  if (loading) {
    return (
      <>
        <TopBar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </>
    );
  }

  if (!client) {
    return (
      <>
        <TopBar />
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <span className="material-symbols-outlined text-slate-300" style={{ fontSize: '48px' }}>person_off</span>
          <p className="text-slate-500 text-[15px]">Cliente não encontrado.</p>
          <Link to="/clients" className="text-primary font-semibold hover:underline text-[13px]">
            Voltar para Clientes
          </Link>
        </div>
      </>
    );
  }

  const pendingDebt = client.balance < 0 ? Math.abs(client.balance) : 0;
  const creditBalance = client.balance > 0 ? client.balance : 0;
  const pendingOrders = orders.filter((o) => o.paymentStatus !== 'PAID');
  const isOverdue = client.clientStatus === 'OVERDUE';
  const bottleTotal = bottles.reduce((s, b) => s + b.quantity, 0);

  return (
    <>
      <TopBar />

      <div className="p-6 max-w-7xl mx-auto space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[13px] text-slate-500">
          <button onClick={() => navigate('/clients')} className="hover:text-primary transition-colors font-medium">
            Clientes
          </button>
          <span className="material-symbols-outlined text-slate-300" style={{ fontSize: '16px' }}>chevron_right</span>
          <span className="text-slate-700 font-semibold">{client.name}</span>
        </div>

        {/* Header card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white font-black text-[17px] flex-shrink-0 shadow-sm shadow-primary/20">
                {getInitials(client.name)}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-[20px] font-black text-slate-800">{client.name}</h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-primary/10 text-primary">
                    {CLIENT_TYPE_LABEL[client.clientType] ?? client.clientType}
                  </span>
                  {isOverdue && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-600">
                      Inadimplente
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-1">
                  {client.phone && (
                    <span className="flex items-center gap-1 text-[12px] text-slate-500">
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>call</span>
                      {client.phone}
                    </span>
                  )}
                  {client.address && (
                    <span className="flex items-center gap-1 text-[12px] text-slate-500">
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>location_on</span>
                      {client.address}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowEditClient(true)}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-lg text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-all"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                Editar
              </button>
              <button
                onClick={() => setShowNewOrder(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-bold shadow-md shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add_shopping_cart</span>
                Novo Pedido
              </button>
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Saldo */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded-lg ${creditBalance > 0 ? 'bg-green-50' : 'bg-slate-100'}`}>
                <span className={`material-symbols-outlined ${creditBalance > 0 ? 'text-green-600' : 'text-slate-400'}`} style={{ fontSize: '20px' }}>
                  account_balance_wallet
                </span>
              </div>
              {creditBalance > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-600">Crédito</span>
              )}
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Saldo</p>
            <p className={`text-[26px] font-black leading-none ${creditBalance > 0 ? 'text-green-600' : 'text-slate-400'}`}>
              {formatBRL(creditBalance)}
            </p>
          </div>

          {/* Débito */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded-lg ${pendingDebt > 0 ? 'bg-red-50' : 'bg-slate-100'}`}>
                <span className={`material-symbols-outlined ${pendingDebt > 0 ? 'text-red-500' : 'text-slate-400'}`} style={{ fontSize: '20px' }}>
                  warning
                </span>
              </div>
              {pendingDebt > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">Em atraso</span>
              )}
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Débito</p>
            <p className={`text-[26px] font-black leading-none ${pendingDebt > 0 ? 'text-red-600' : 'text-slate-400'}`}>
              {formatBRL(pendingDebt)}
            </p>
          </div>

          {/* Fidelidade */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <span className="material-symbols-outlined text-amber-500" style={{ fontSize: '20px' }}>workspace_premium</span>
              </div>
              {client.pendingBonusWater > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                  {client.pendingBonusWater} bônus
                </span>
              )}
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Pontos</p>
            <p className="text-[26px] font-black leading-none text-amber-500">
              {client.fidelityPoints.toLocaleString('pt-BR')}
            </p>
          </div>

          {/* Vasilhames */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>propane_tank</span>
              </div>
              {bottleTotal > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">No campo</span>
              )}
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Vasilhames</p>
            <p className="text-[26px] font-black leading-none text-primary">
              {bottleTotal > 0 ? `${bottleTotal} un` : '—'}
            </p>
          </div>
        </div>

        {/* Tabs + content */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-card">
          {/* Tab bar */}
          <div className="border-b border-slate-200 px-2 flex items-end gap-0.5 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 py-3.5 px-4 border-b-2 text-[13px] font-semibold transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{tab.icon}</span>
                {tab.label}
                {tab.id === 'pedidos' && orders.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">{orders.length}</span>
                )}
                {tab.id === 'pagamentos' && pendingOrders.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">{pendingOrders.length}</span>
                )}
                {tab.id === 'vasilhames' && bottleTotal > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">{bottleTotal}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-5">

            {/* ── PEDIDOS ── */}
            {activeTab === 'pedidos' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">ID</th>
                      <th className="py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                      <th className="py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Itens</th>
                      <th className="py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                      <th className="py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Entrega</th>
                      <th className="py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pagamento</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center">
                          <span className="material-symbols-outlined block mb-2 text-slate-200" style={{ fontSize: '32px' }}>inbox</span>
                          <p className="text-[13px] text-slate-400">Nenhum pedido encontrado.</p>
                        </td>
                      </tr>
                    ) : (
                      orders.map((order) => {
                        const statusBadge = getOrderStatusBadge(order.status);
                        const payBadge = getPaymentStatusBadge(order.paymentStatus);
                        const itemsSummary = order.items.slice(0, 3).map((i) => `${i.productName} ×${i.quantity}`).join(', ')
                          + (order.items.length > 3 ? ` +${order.items.length - 3}` : '');
                        return (
                          <tr
                            key={order.id}
                            onClick={() => navigate(`/orders/${order.id}`)}
                            className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                          >
                            <td className="px-4 py-3 font-mono font-semibold text-[13px] text-primary">{formatOrderId(order.id)}</td>
                            <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">{formatDateTime(order.createDate)}</td>
                            <td className="px-4 py-3 text-[12px] text-slate-600 max-w-[180px]">
                              <span className="line-clamp-1">{itemsSummary || '—'}</span>
                            </td>
                            <td className="px-4 py-3 text-[13px] font-bold text-slate-800 whitespace-nowrap">{formatBRL(order.totalValue)}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusBadge.className}`}>{statusBadge.label}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${payBadge.className}`}>{payBadge.label}</span>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span className="material-symbols-outlined text-slate-300" style={{ fontSize: '17px' }}>chevron_right</span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── PAGAMENTOS EM LOTE ── */}
            {activeTab === 'pagamentos' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Lista de pendentes */}
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Pedidos em Aberto ({pendingOrders.length})
                  </p>
                  {pendingOrders.length === 0 ? (
                    <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-xl">
                      <span className="material-symbols-outlined text-green-600" style={{ fontSize: '20px' }}>check_circle</span>
                      <p className="text-[13px] font-semibold text-green-700">Nenhum pedido em aberto.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pendingOrders.slice(0, 6).map((order) => (
                        <div key={order.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                          <div>
                            <p className="font-semibold text-[13px] text-slate-700">{formatOrderId(order.id)}</p>
                            <p className="text-[11px] text-slate-400">{formatDateTime(order.createDate)}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-[14px] text-slate-800">{formatBRL(order.totalValue)}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getPaymentStatusBadge(order.paymentStatus).className}`}>
                              {getPaymentStatusBadge(order.paymentStatus).label}
                            </span>
                          </div>
                        </div>
                      ))}
                      {pendingOrders.length > 6 && (
                        <p className="text-[12px] text-slate-400 text-center py-1">+ {pendingOrders.length - 6} pedidos adicionais</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Formulário */}
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Registrar Liquidação</p>
                  <div className="space-y-4">
                    {bulkSuccess && (
                      <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg border border-green-100">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
                        <span className="text-[12px] font-semibold">Pagamento registrado com sucesso!</span>
                      </div>
                    )}
                    {bulkError && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg border border-red-100">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>error</span>
                        <span className="text-[12px]">{bulkError}</span>
                      </div>
                    )}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Valor (R$) *</label>
                      <input type="number" step="0.01" min={0.01} value={bulkAmount}
                        onChange={(e) => setBulkAmount(e.target.value)} placeholder="0,00" className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Forma de Pagamento</label>
                      <div className="flex gap-2">
                        {(['PIX', 'DINHEIRO', 'SALDO'] as PaymentMethod[]).map((m) => (
                          <button key={m} type="button" onClick={() => setBulkMethod(m)}
                            className={`flex-1 py-2 rounded-lg border text-[12px] font-bold transition-all ${
                              bulkMethod === m ? 'bg-primary text-white border-primary' : 'border-slate-200 text-slate-500 hover:border-primary/40'
                            }`}>
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button onClick={handleBulkPayment} disabled={bulkSubmitting || !bulkAmount}
                      className="w-full bg-primary text-white py-3 rounded-lg font-bold text-[13px] shadow-md shadow-primary/20 hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>payments</span>
                      {bulkSubmitting ? 'Processando...' : 'Confirmar Liquidação'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── PREÇOS CUSTOMIZADOS ── */}
            {activeTab === 'precos' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Preços Acordados</p>
                  {prices.length === 0 ? (
                    <div className="text-center py-10 border border-slate-200 rounded-xl">
                      <span className="material-symbols-outlined block mb-2 text-slate-200" style={{ fontSize: '36px' }}>price_change</span>
                      <p className="text-[13px] text-slate-400">Nenhum preço customizado.</p>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Produto</th>
                            <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Preço Especial</th>
                            <th className="px-4 py-3 w-10" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {prices.map((price) => (
                            <tr key={price.id} className="hover:bg-slate-50 transition-colors group">
                              <td className="px-4 py-3 text-[13px] font-semibold text-slate-700">{price.productName}</td>
                              <td className="px-4 py-3 text-right text-[13px] font-black text-primary">{formatBRL(price.customPrice)}</td>
                              <td className="px-4 py-3 text-right">
                                <button onClick={async () => { await http!.delete(`/clients/${id}/prices/${price.id}`); fetchPrices(); }}
                                  className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all" title="Remover">
                                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Adicionar / Atualizar Preço</p>
                  <div className="space-y-4 p-5 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Produto *</label>
                      <select value={priceForm.productId} onChange={(e) => setPriceForm((f) => ({ ...f, productId: e.target.value }))} className={inputClass}>
                        <option value="">Selecione um produto...</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatBRL(p.basePrice)} (base)</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Preço Especial (R$) *</label>
                      <input type="number" step="0.01" min="0.01" value={priceForm.customPrice}
                        onChange={(e) => setPriceForm((f) => ({ ...f, customPrice: e.target.value }))}
                        placeholder="0,00" className={inputClass} />
                    </div>
                    {priceError && <p className="text-[12px] text-red-500">{priceError}</p>}
                    <button disabled={priceSubmitting || !priceForm.productId || !priceForm.customPrice}
                      onClick={async () => {
                        const price = parseFloat(priceForm.customPrice);
                        if (!priceForm.productId || isNaN(price) || price <= 0) { setPriceError('Preencha produto e preço válido.'); return; }
                        setPriceSubmitting(true); setPriceError(null);
                        try {
                          const payload: ClientPriceRequestDTO = { productId: priceForm.productId, customPrice: price };
                          await http!.post(`/clients/${id}/prices`, payload);
                          setPriceForm({ productId: '', customPrice: '' }); fetchPrices();
                        } catch { setPriceError('Erro ao salvar preço. Verifique se o valor é menor que o preço base.'); }
                        finally { setPriceSubmitting(false); }
                      }}
                      className="w-full bg-primary text-white py-2.5 rounded-lg font-bold text-[13px] hover:brightness-110 transition-all disabled:opacity-60">
                      {priceSubmitting ? 'Salvando...' : 'Salvar Preço Especial'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── FIDELIDADE ── */}
            {activeTab === 'fidelidade' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Pontos em destaque */}
                <div className="md:col-span-1 bg-amber-50 border border-amber-100 rounded-xl p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <span className="material-symbols-outlined text-amber-400" style={{ fontSize: '28px' }}>workspace_premium</span>
                    <button onClick={() => setShowAddPoints(true)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-[11px] font-bold hover:brightness-110 transition-all">
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
                      Adicionar
                    </button>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-amber-600/70 uppercase tracking-wider mb-1">Pontos acumulados</p>
                    <p className="text-[40px] font-black text-amber-500 leading-none">{client.fidelityPoints.toLocaleString('pt-BR')}</p>
                    <p className="text-[12px] text-amber-600/70 mt-1">pontos de fidelidade</p>
                  </div>
                  {client.pendingBonusWater > 0 && (
                    <div className="mt-4 flex items-center gap-2 p-3 bg-amber-100 rounded-lg">
                      <span className="material-symbols-outlined text-amber-600" style={{ fontSize: '16px' }}>redeem</span>
                      <p className="text-[12px] font-semibold text-amber-700">
                        {client.pendingBonusWater} galão(ões) bônus disponível
                      </p>
                    </div>
                  )}
                </div>

                {/* Progresso */}
                <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-4">Progresso para próxima água bônus</p>
                  <div className="mb-3">
                    <div className="flex justify-between text-[12px] text-slate-500 mb-1.5">
                      <span>{client.fidelityPoints.toLocaleString('pt-BR')} pts acumulados</span>
                      <span>Meta: 3.000 pts</span>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-400 h-full rounded-full transition-all"
                        style={{ width: `${Math.min((client.fidelityPoints / 3000) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {Math.max(0, 3000 - client.fidelityPoints).toLocaleString('pt-BR')} pontos restantes para ganhar 1 galão
                    </p>
                  </div>
                  <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
                    <div className="flex justify-between text-[13px]">
                      <span className="text-slate-500">Saldo de pontos</span>
                      <span className="font-bold text-amber-500">{client.fidelityPoints.toLocaleString('pt-BR')} pts</span>
                    </div>
                    {client.pendingBonusWater > 0 && (
                      <div className="flex justify-between text-[13px]">
                        <span className="text-slate-500">Bônus disponível</span>
                        <span className="font-bold text-amber-600">{client.pendingBonusWater} galão(ões)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── VASILHAMES ── */}
            {activeTab === 'vasilhames' && (
              <div>
                {bottles.length === 0 ? (
                  <div className="text-center py-12">
                    <span className="material-symbols-outlined block mb-2 text-slate-200" style={{ fontSize: '40px' }}>propane_tank</span>
                    <p className="text-[13px] text-slate-400">Nenhum vasilhame emprestado.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {bottles.map((bottle) => (
                      <div key={bottle.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>propane_tank</span>
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold text-slate-700">{bottle.productName}</p>
                            {bottle.loanDate && (
                              <p className="text-[11px] text-slate-400">Emprestado em {formatDateTime(bottle.loanDate)}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-[20px] font-black text-slate-800">{bottle.quantity}</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">unidades</p>
                          </div>
                          <button onClick={() => setReturnTarget(bottle.id)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-[12px] font-bold hover:brightness-110 transition-all">
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>assignment_return</span>
                            Devolver
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <NewOrderModal open={showNewOrder} onClose={() => setShowNewOrder(false)}
        onSuccess={() => { fetchOrders(); fetchClient(); }} defaultClient={client} />
      <NewClientModal open={showEditClient} onClose={() => setShowEditClient(false)}
        onSuccess={() => { setShowEditClient(false); fetchClient(); }} client={client} />
      <ConfirmModal open={returnTarget !== null} title="Registrar Devolução"
        message="Confirmar a devolução deste vasilhame?" confirmLabel="Confirmar Devolução"
        onConfirm={registerReturn} onClose={() => setReturnTarget(null)} />
      <AddFidelityPointsModal open={showAddPoints} onClose={() => setShowAddPoints(false)}
        onSuccess={() => { setShowAddPoints(false); fetchClient(); }}
        clientId={client.id} clientName={client.name} />
    </>
  );
}
