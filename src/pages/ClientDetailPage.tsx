import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
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

const TABS: { id: TabId; label: string }[] = [
  { id: 'pedidos', label: 'Pedidos' },
  { id: 'pagamentos', label: 'Pagamentos em Lote' },
  { id: 'precos', label: 'Preços Customizados' },
  { id: 'fidelidade', label: 'Fidelidade' },
  { id: 'vasilhames', label: 'Vasilhames' },
];

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { http } = useAuth();

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
    http
      .get<ClientResponseDTO>(`/clients/${id}`)
      .then((r) => setClient(r.data))
      .catch(() => {});
  }

  function fetchOrders() {
    if (!http || !id) return;
    http
      .get<SpringPage<OrderResponseDTO>>(`/orders/client/${id}`, { params: { size: 50 } })
      .then((r) => setOrders(r.data.content))
      .catch(() => setOrders([]));
  }

  function fetchBottles() {
    if (!http || !id) return;
    http
      .get<SpringPage<LoanedBottleResponseDTO>>(`/bottles/client/${id}`, { params: { size: 50 } })
      .then((r) => setBottles(r.data.content))
      .catch(() => setBottles([]));
  }

  function fetchPrices() {
    if (!http || !id) return;
    http
      .get<ClientPriceResponseDTO[]>(`/clients/${id}/prices`)
      .then((r) => setPrices(r.data))
      .catch(() => setPrices([]));
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

  const pendingDebt = client && client.balance < 0 ? Math.abs(client.balance) : 0;
  const creditBalance = client && client.balance > 0 ? client.balance : 0;
  const pendingOrders = orders.filter((o) => o.paymentStatus !== 'PAID');

  const inputClass =
    'w-full border border-outline-variant rounded-lg bg-surface-container-low text-body-md py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';

  if (loading) {
    return (
      <>
        <TopBar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-on-surface-variant text-body-lg">Carregando...</p>
        </div>
      </>
    );
  }

  if (!client) {
    return (
      <>
        <TopBar />
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <span className="material-symbols-outlined text-outline" style={{ fontSize: '48px' }}>
            person_off
          </span>
          <p className="text-on-surface-variant text-body-lg">Cliente não encontrado.</p>
          <Link to="/clients" className="text-primary font-bold hover:underline">
            Voltar para lista de clientes
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar />

      <main className="p-6 bg-background min-h-screen">
        <Link
          to="/clients"
          className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors text-body-md mb-4 w-fit"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            arrow_back
          </span>
          Voltar para Clientes
        </Link>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 bg-primary-container text-on-primary-container rounded-xl flex items-center justify-center text-h2 font-black shadow-sm flex-shrink-0">
              {getInitials(client.name)}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-h1 text-on-surface">{client.name}</h1>
                <span className="px-2 py-0.5 bg-primary-fixed text-on-primary-fixed text-label-sm rounded-full">
                  {client.clientType}
                </span>
                {client.clientStatus === 'OVERDUE' && (
                  <span className="px-2 py-0.5 bg-error-container text-on-error-container text-label-sm rounded-full">
                    INADIMPLENTE
                  </span>
                )}
              </div>
              {client.address && (
                <p className="text-body-md text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    location_on
                  </span>
                  {client.address}
                </p>
              )}
              {client.phone && (
                <p className="text-body-md text-on-surface-variant flex items-center gap-1 mt-1">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    call
                  </span>
                  {client.phone}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowNewOrder(true)}
              className="bg-primary text-on-primary px-6 py-2.5 rounded-lg font-bold hover:brightness-110 transition-all flex items-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined">add_shopping_cart</span>
              Novo Pedido
            </button>
            <button
              onClick={() => setShowEditClient(true)}
              className="border border-outline-variant bg-surface px-6 py-2.5 rounded-lg font-bold hover:bg-surface-container-low transition-all"
            >
              Editar Perfil
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-surface border border-outline-variant p-4 rounded-xl">
            <p className="text-label-sm text-on-surface-variant mb-1">SALDO ATUAL</p>
            <p
              className={`text-h2 font-black ${
                client.balance < 0 ? 'text-error' : 'text-on-surface'
              }`}
            >
              {formatBRL(creditBalance)}
            </p>
            <p className="text-label-sm text-on-surface-variant mt-1">Crédito disponível</p>
          </div>

          <div className="bg-surface border border-outline-variant p-4 rounded-xl">
            <p className="text-label-sm text-on-surface-variant mb-1">DÉBITO PENDENTE</p>
            <p
              className={`text-h2 font-black ${pendingDebt > 0 ? 'text-error' : 'text-on-surface'}`}
            >
              {formatBRL(pendingDebt)}
            </p>
            {pendingDebt > 0 && (
              <p className="text-label-sm text-error mt-1">Pagamento em atraso</p>
            )}
          </div>

          <div className="bg-surface border border-outline-variant p-4 rounded-xl">
            <p className="text-label-sm text-on-surface-variant mb-1">PONTOS FIDELIDADE</p>
            <p className="text-h2 font-black text-tertiary">
              {client.fidelityPoints.toLocaleString('pt-BR')} pts
            </p>
            {client.pendingBonusWater > 0 && (
              <p className="text-label-sm text-tertiary mt-1">
                {client.pendingBonusWater} galão(ões) a resgatar
              </p>
            )}
          </div>

          <div className="bg-surface border border-outline-variant p-4 rounded-xl">
            <p className="text-label-sm text-on-surface-variant mb-1">VASILHAMES EMPRESTADOS</p>
            <p className="text-h2 font-black text-primary">
              {bottles.length > 0
                ? `${bottles.reduce((s, b) => s + b.quantity, 0)} und`
                : '—'}
            </p>
            {bottles.length > 0 && (
              <p className="text-label-sm text-on-surface-variant mt-1">
                {bottles.length} tipo(s) de vasilhame
              </p>
            )}
          </div>
        </div>

        <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
          <div className="border-b border-outline-variant bg-surface-container-low px-4 flex items-end gap-2 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-3 border-b-2 font-bold text-body-md transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-on-surface-variant hover:text-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === 'pedidos' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-surface-container border-b border-outline-variant">
                    <tr>
                      <th className="py-3 px-4 text-label-sm text-on-surface-variant">ID PEDIDO</th>
                      <th className="py-3 px-4 text-label-sm text-on-surface-variant">DATA</th>
                      <th className="py-3 px-4 text-label-sm text-on-surface-variant">TOTAL</th>
                      <th className="py-3 px-4 text-label-sm text-on-surface-variant">ENTREGA</th>
                      <th className="py-3 px-4 text-label-sm text-on-surface-variant">PAGAMENTO</th>
                      <th className="py-3 px-4" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {orders.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-10 text-center text-on-surface-variant text-body-md"
                        >
                          Nenhum pedido encontrado para este cliente.
                        </td>
                      </tr>
                    ) : (
                      orders.map((order) => {
                        const statusBadge = getOrderStatusBadge(order.status);
                        const payBadge = getPaymentStatusBadge(order.paymentStatus);
                        return (
                          <tr
                            key={order.id}
                            className="hover:bg-surface-container-lowest transition-colors h-14"
                          >
                            <td className="px-4 font-bold text-body-md">
                              {formatOrderId(order.id)}
                            </td>
                            <td className="px-4 text-body-md text-on-surface-variant">
                              {formatDateTime(order.createDate)}
                            </td>
                            <td className="px-4 text-body-md font-bold">
                              {formatBRL(order.totalValue)}
                            </td>
                            <td className="px-4">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-label-sm font-bold ${statusBadge.className}`}
                              >
                                {statusBadge.label}
                              </span>
                            </td>
                            <td className="px-4">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-label-sm font-bold ${payBadge.className}`}
                              >
                                {payBadge.label}
                              </span>
                            </td>
                            <td className="px-4 text-right">
                              <button className="text-primary hover:underline font-bold text-label-sm">
                                Ver Detalhes
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'pagamentos' && (
              <div className="max-w-2xl">
                <h3 className="text-h3 text-on-surface mb-2">Registrar Pagamento em Lote</h3>
                <p className="text-on-surface-variant mb-6 text-body-md">
                  Registre um pagamento que cobre múltiplos pedidos em aberto do cliente.
                </p>

                {pendingOrders.length > 0 && (
                  <div className="space-y-2 mb-6">
                    <p className="text-label-sm text-on-surface-variant mb-2">
                      PEDIDOS EM ABERTO ({pendingOrders.length})
                    </p>
                    {pendingOrders.slice(0, 5).map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-3 border border-outline-variant rounded-lg"
                      >
                        <div>
                          <p className="font-bold text-body-md">{formatOrderId(order.id)}</p>
                          <p className="text-label-sm text-on-surface-variant">
                            {formatDateTime(order.createDate)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-body-lg">{formatBRL(order.totalValue)}</p>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getPaymentStatusBadge(order.paymentStatus).className}`}
                          >
                            {getPaymentStatusBadge(order.paymentStatus).label}
                          </span>
                        </div>
                      </div>
                    ))}
                    {pendingOrders.length > 5 && (
                      <p className="text-label-sm text-on-surface-variant text-center py-2">
                        + {pendingOrders.length - 5} pedidos adicionais
                      </p>
                    )}
                  </div>
                )}

                {pendingOrders.length === 0 && (
                  <div className="text-center py-6 mb-6 text-on-surface-variant text-body-md border border-outline-variant rounded-lg">
                    Nenhum pedido em aberto.
                  </div>
                )}

                {bulkSuccess && (
                  <div className="flex items-center gap-2 p-3 mb-4 bg-green-50 text-green-700 rounded-lg">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                    <span className="text-label-sm font-bold">Pagamento registrado com sucesso!</span>
                  </div>
                )}

                {bulkError && (
                  <div className="flex items-center gap-2 p-3 mb-4 bg-error-container text-on-error-container rounded-lg">
                    <span className="material-symbols-outlined text-error" style={{ fontSize: '18px' }}>error</span>
                    <span className="text-label-sm">{bulkError}</span>
                  </div>
                )}

                <div className="bg-surface-container p-6 rounded-xl mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-label-sm font-bold text-on-surface-variant mb-1">
                        VALOR (R$) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min={0.01}
                        value={bulkAmount}
                        onChange={(e) => setBulkAmount(e.target.value)}
                        placeholder="0,00"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-label-sm font-bold text-on-surface-variant mb-1">
                        FORMA DE PAGAMENTO
                      </label>
                      <select
                        value={bulkMethod}
                        onChange={(e) => setBulkMethod(e.target.value as PaymentMethod)}
                        className={inputClass}
                      >
                        <option value="PIX">PIX</option>
                        <option value="DINHEIRO">Dinheiro</option>
                        <option value="SALDO">Saldo</option>
                      </select>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleBulkPayment}
                  disabled={bulkSubmitting || !bulkAmount}
                  className="w-full bg-primary text-on-primary py-4 rounded-lg font-bold shadow-sm hover:brightness-110 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {bulkSubmitting ? 'Processando...' : 'Confirmar Liquidação'}
                </button>
              </div>
            )}

            {activeTab === 'precos' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Tabela de preços */}
                <div>
                  <h3 className="text-h3 text-on-surface mb-4">Preços Acordados</h3>
                  {prices.length === 0 ? (
                    <div className="text-center py-10 text-on-surface-variant border border-outline-variant rounded-xl">
                      <span className="material-symbols-outlined block mb-2 text-outline" style={{ fontSize: '40px' }}>price_change</span>
                      <p className="text-body-md">Nenhum preço customizado cadastrado.</p>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-outline-variant">
                      <table className="w-full text-left">
                        <thead className="bg-surface-container-low border-b border-outline-variant">
                          <tr>
                            <th className="px-4 py-3 text-label-sm text-on-surface-variant">PRODUTO</th>
                            <th className="px-4 py-3 text-label-sm text-on-surface-variant text-right">PREÇO ESPECIAL</th>
                            <th className="px-4 py-3 w-12" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant">
                          {prices.map((price) => (
                            <tr key={price.id} className="hover:bg-surface-container transition-colors group">
                              <td className="px-4 py-3 font-semibold text-on-surface">{price.productName}</td>
                              <td className="px-4 py-3 text-right font-black text-primary">{formatBRL(price.customPrice)}</td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={async () => {
                                    await http!.delete(`/clients/${id}/prices/${price.id}`);
                                    fetchPrices();
                                  }}
                                  className="p-1.5 text-error hover:bg-error/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                  title="Remover"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Formulário de novo preço */}
                <div>
                  <h3 className="text-h3 text-on-surface mb-4">Adicionar / Atualizar Preço</h3>
                  <div className="bg-surface-container rounded-xl p-6 space-y-4">
                    <div>
                      <label className="block text-label-sm text-on-surface-variant uppercase mb-1.5">Produto *</label>
                      <select
                        value={priceForm.productId}
                        onChange={(e) => setPriceForm((f) => ({ ...f, productId: e.target.value }))}
                        className={inputClass}
                      >
                        <option value="">Selecione um produto...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — {formatBRL(p.basePrice)} (base)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-label-sm text-on-surface-variant uppercase mb-1.5">Preço Especial (R$) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={priceForm.customPrice}
                        onChange={(e) => setPriceForm((f) => ({ ...f, customPrice: e.target.value }))}
                        placeholder="0,00"
                        className={inputClass}
                      />
                    </div>
                    {priceError && <p className="text-sm text-error">{priceError}</p>}
                    <button
                      disabled={priceSubmitting || !priceForm.productId || !priceForm.customPrice}
                      onClick={async () => {
                        const price = parseFloat(priceForm.customPrice);
                        if (!priceForm.productId || isNaN(price) || price <= 0) {
                          setPriceError('Preencha produto e preço válido.');
                          return;
                        }
                        setPriceSubmitting(true);
                        setPriceError(null);
                        try {
                          const payload: ClientPriceRequestDTO = { productId: priceForm.productId, customPrice: price };
                          await http!.post(`/clients/${id}/prices`, payload);
                          setPriceForm({ productId: '', customPrice: '' });
                          fetchPrices();
                        } catch {
                          setPriceError('Erro ao salvar preço. Verifique se o valor é menor que o preço base.');
                        } finally {
                          setPriceSubmitting(false);
                        }
                      }}
                      className="w-full bg-primary text-on-primary py-3 rounded-lg font-bold hover:brightness-110 transition-all disabled:opacity-60"
                    >
                      {priceSubmitting ? 'Salvando...' : 'Salvar Preço Especial'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'fidelidade' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-h3 text-on-surface">Extrato de Pontos</h3>
                    <button
                      onClick={() => setShowAddPoints(true)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-tertiary text-on-tertiary rounded-lg font-bold text-label-sm hover:brightness-110 transition-all"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        add_circle
                      </span>
                      Adicionar Pontos
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between py-3 border-b border-outline-variant">
                      <div>
                        <p className="font-bold text-body-md">Saldo Atual</p>
                        <p className="text-label-sm text-on-surface-variant">Total acumulado</p>
                      </div>
                      <p className="text-green-600 font-bold text-body-md">
                        {client.fidelityPoints.toLocaleString('pt-BR')} pts
                      </p>
                    </div>
                    {client.pendingBonusWater > 0 && (
                      <div className="flex justify-between py-3 border-b border-outline-variant">
                        <div>
                          <p className="font-bold text-body-md">Bônus Disponível</p>
                          <p className="text-label-sm text-on-surface-variant">Galões de água</p>
                        </div>
                        <p className="text-tertiary font-bold text-body-md">
                          {client.pendingBonusWater} galão(ões)
                        </p>
                      </div>
                    )}
                    <p className="text-on-surface-variant text-body-md text-center py-4">
                      Histórico detalhado em breve.
                    </p>
                  </div>
                </div>
                <div className="bg-tertiary-fixed p-6 rounded-2xl flex flex-col justify-center items-center text-center">
                  <span
                    className="material-symbols-outlined text-on-tertiary-fixed mb-4"
                    style={{ fontSize: '64px' }}
                  >
                    workspace_premium
                  </span>
                  <h4 className="text-h2 text-on-tertiary-fixed mb-2">Programa de Fidelidade</h4>
                  <p className="text-on-tertiary-fixed-variant text-body-md mb-6">
                    <strong>{client.fidelityPoints.toLocaleString('pt-BR')} pontos</strong>{' '}
                    acumulados
                  </p>
                  <div className="w-full bg-on-tertiary-fixed/10 h-3 rounded-full overflow-hidden mb-6">
                    <div
                      className="bg-tertiary-container h-full rounded-full"
                      style={{
                        width: `${Math.min((client.fidelityPoints / 3000) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <button className="bg-on-tertiary-fixed text-tertiary-fixed px-8 py-2.5 rounded-lg font-black hover:opacity-90 transition-opacity">
                    VER PRÊMIOS
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'vasilhames' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-h3 text-on-surface">Controle de Comodatos e Empréstimos</h3>
                </div>
                {bottles.length === 0 ? (
                  <div className="text-center py-10 text-on-surface-variant">
                    <span
                      className="material-symbols-outlined block mb-2 text-outline"
                      style={{ fontSize: '48px' }}
                    >
                      propane_tank
                    </span>
                    <p className="text-body-md">Nenhum vasilhame emprestado registrado.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bottles.map((bottle) => (
                      <div
                        key={bottle.id}
                        className="bg-surface-container-low border border-outline-variant p-4 rounded-xl flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded bg-surface border border-outline-variant flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary">
                              propane_tank
                            </span>
                          </div>
                          <div>
                            <p className="font-bold text-body-md">{bottle.productName}</p>
                            {bottle.loanDate && (
                              <p className="text-label-sm text-on-surface-variant">
                                Emprestado em: {formatDateTime(bottle.loanDate)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-label-sm text-on-surface-variant">QUANTIDADE</p>
                            <p className="font-black text-body-lg">{bottle.quantity} UN</p>
                          </div>
                          <button
                            onClick={() => setReturnTarget(bottle.id)}
                            className="flex items-center gap-1 px-4 py-2 bg-primary-container text-on-primary-container rounded-lg font-bold text-label-sm hover:brightness-110 transition-all"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                              assignment_return
                            </span>
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
      </main>

      <NewOrderModal
        open={showNewOrder}
        onClose={() => setShowNewOrder(false)}
        onSuccess={() => { fetchOrders(); fetchClient(); }}
        defaultClient={client}
      />

      <NewClientModal
        open={showEditClient}
        onClose={() => setShowEditClient(false)}
        onSuccess={() => { setShowEditClient(false); fetchClient(); }}
        client={client}
      />

      <ConfirmModal
        open={returnTarget !== null}
        title="Registrar Devolução"
        message="Confirmar a devolução deste vasilhame?"
        confirmLabel="Confirmar Devolução"
        onConfirm={registerReturn}
        onClose={() => setReturnTarget(null)}
      />

      <AddFidelityPointsModal
        open={showAddPoints}
        onClose={() => setShowAddPoints(false)}
        onSuccess={() => { setShowAddPoints(false); fetchClient(); }}
        clientId={client.id}
        clientName={client.name}
      />
    </>
  );
}
