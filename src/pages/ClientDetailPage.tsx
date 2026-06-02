import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import type { ClientResponseDTO, OrderResponseDTO, SpringPage } from '../types';
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

type OrdersResponse = SpringPage<OrderResponseDTO> | OrderResponseDTO[];

function extractOrders(data: OrdersResponse): OrderResponseDTO[] {
  if (Array.isArray(data)) return data;
  return data.content;
}

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { http } = useAuth();
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<ClientResponseDTO | null>(null);
  const [orders, setOrders] = useState<OrderResponseDTO[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('pedidos');

  useEffect(() => {
    if (!http || !id) return;

    Promise.all([
      http.get<ClientResponseDTO>(`/clients/${id}`),
      http.get<OrdersResponse>(`/orders/client/${id}`),
    ])
      .then(([clientRes, ordersRes]) => {
        setClient(clientRes.data);
        setOrders(extractOrders(ordersRes.data));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [http, id]);

  const pendingDebt = client && client.balance < 0 ? Math.abs(client.balance) : 0;
  const creditBalance = client && client.balance > 0 ? client.balance : 0;

  if (loading) {
    return (
      <>
        <TopBar />
        <div className="p-6 flex items-center justify-center min-h-[60vh]">
          <p className="text-on-surface-variant text-body-lg">Carregando...</p>
        </div>
      </>
    );
  }

  if (!client) {
    return (
      <>
        <TopBar />
        <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4">
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
        <div className="mb-6">
          <Link
            to="/clients"
            className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors text-body-md mb-4 w-fit"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
            Voltar para Clientes
          </Link>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div className="flex items-start gap-6">
              <div className="w-20 h-20 bg-primary-container text-on-primary-container rounded-xl flex items-center justify-center text-h1 shadow-sm flex-shrink-0">
                {getInitials(client.name)}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-h1 text-on-surface">{client.name}</h1>
                  {client.type && (
                    <span className="px-2 py-0.5 bg-primary-fixed text-on-primary-fixed text-label-sm rounded-full">
                      {client.type}
                    </span>
                  )}
                </div>
                {client.email && (
                  <p className="text-body-md text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>mail</span>
                    {client.email}
                  </p>
                )}
                {client.phone && (
                  <p className="text-body-md text-on-surface-variant flex items-center gap-1 mt-1">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>call</span>
                    {client.phone}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="bg-primary text-on-primary px-6 py-2.5 rounded-lg font-bold hover:brightness-110 transition-all flex items-center gap-2 shadow-sm">
                <span className="material-symbols-outlined">add_shopping_cart</span>
                Novo Pedido
              </button>
              <button className="border border-outline-variant bg-surface px-6 py-2.5 rounded-lg font-bold hover:bg-surface-container-low transition-all">
                Editar Perfil
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-surface border border-outline-variant p-4 rounded-xl">
            <p className="text-label-sm text-on-surface-variant mb-1">SALDO ATUAL</p>
            <p className={`text-h2 font-black ${client.balance < 0 ? 'text-error' : 'text-on-surface'}`}>
              {formatBRL(creditBalance)}
            </p>
            <p className="text-label-sm text-on-surface-variant mt-1">Crédito disponível</p>
          </div>

          <div className="bg-surface border border-outline-variant p-4 rounded-xl">
            <p className="text-label-sm text-on-surface-variant mb-1">DÉBITO PENDENTE</p>
            <p className={`text-h2 font-black ${pendingDebt > 0 ? 'text-error' : 'text-on-surface'}`}>
              {formatBRL(pendingDebt)}
            </p>
            {pendingDebt > 0 && (
              <p className="text-label-sm text-error mt-1">Pagamento em atraso</p>
            )}
          </div>

          <div className="bg-surface border border-outline-variant p-4 rounded-xl">
            <p className="text-label-sm text-on-surface-variant mb-1">PONTOS FIDELIDADE</p>
            <p className="text-h2 font-black text-tertiary">{client.fidelityPoints.toLocaleString('pt-BR')} pts</p>
            <p className="text-label-sm text-tertiary mt-1">Programa de recompensas</p>
          </div>

          <div className="bg-surface border border-outline-variant p-4 rounded-xl">
            <p className="text-label-sm text-on-surface-variant mb-1">VASILHAMES EMPRESTADOS</p>
            <p className="text-h2 font-black text-primary">—</p>
            <p className="text-label-sm text-on-surface-variant mt-1">Empréstimos ativos</p>
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
                    ? 'border-primary-container text-primary'
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
                      <th className="py-3 px-4 text-label-sm text-on-surface-variant">STATUS ENTREGA</th>
                      <th className="py-3 px-4 text-label-sm text-on-surface-variant">STATUS PAGAMENTO</th>
                      <th className="py-3 px-4" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-on-surface-variant text-body-md">
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
                            <td className="px-4 font-bold text-body-md">{formatOrderId(order.id)}</td>
                            <td className="px-4 text-body-md text-on-surface-variant">
                              {formatDateTime(order.createDate)}
                            </td>
                            <td className="px-4 text-body-md font-bold">{formatBRL(order.totalValue)}</td>
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
                  Selecione as faturas em aberto para realizar o fechamento financeiro.
                </p>
                <div className="space-y-3 mb-6">
                  {orders.filter((o) => o.paymentStatus !== 'PAID').slice(0, 3).map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-4 border border-outline-variant rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary/20"
                        />
                        <div>
                          <p className="font-bold text-body-md">Pedido {formatOrderId(order.id)}</p>
                          <p className="text-label-sm text-on-surface-variant">
                            {formatDateTime(order.createDate)}
                          </p>
                        </div>
                      </div>
                      <p className="font-black text-body-lg">{formatBRL(order.totalValue)}</p>
                    </div>
                  ))}
                  {orders.filter((o) => o.paymentStatus !== 'PAID').length === 0 && (
                    <p className="text-on-surface-variant text-body-md text-center py-6">
                      Nenhuma fatura em aberto.
                    </p>
                  )}
                </div>
                <div className="bg-surface-container p-6 rounded-xl mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-label-sm font-bold text-on-surface-variant mb-1">
                        FORMA DE PAGAMENTO
                      </label>
                      <select className="w-full border border-outline-variant rounded-lg bg-surface text-body-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20">
                        <option>PIX</option>
                        <option>Boleto</option>
                        <option>Cartão de Crédito</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-label-sm font-bold text-on-surface-variant mb-1">
                        DATA DO RECEBIMENTO
                      </label>
                      <input
                        type="date"
                        className="w-full border border-outline-variant rounded-lg bg-surface text-body-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                </div>
                <button className="w-full bg-primary text-on-primary py-4 rounded-lg font-bold shadow-sm hover:brightness-110 transition-all">
                  Confirmar Liquidação
                </button>
              </div>
            )}

            {activeTab === 'precos' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-h3 text-on-surface">Lista de Preços Acordados</h3>
                  <button className="text-primary font-bold flex items-center gap-1 text-body-md">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                    Ajustar Tabelas
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { name: 'Gás P13 (Cozinha)', icon: 'propane_tank', base: 110, custom: 102 },
                    { name: 'Água Mineral 20L', icon: 'water_drop', base: 15, custom: 12.5 },
                  ].map((item) => (
                    <div
                      key={item.name}
                      className="p-4 border border-outline-variant rounded-xl flex items-center gap-4"
                    >
                      <div className="w-16 h-16 bg-surface-container rounded-lg flex items-center justify-center flex-shrink-0">
                        <span
                          className="material-symbols-outlined text-on-surface-variant"
                          style={{ fontSize: '32px' }}
                        >
                          {item.icon}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-body-md">{item.name}</p>
                        <p className="text-label-sm text-on-surface-variant">
                          Preço Padrão: {formatBRL(item.base)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-primary text-h3">{formatBRL(item.custom)}</p>
                        <p className="text-[10px] text-green-600 font-bold">
                          -{(((item.base - item.custom) / item.base) * 100).toFixed(1)}% DESC.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'fidelidade' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-h3 text-on-surface mb-4">Extrato de Pontos</h3>
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
                    <strong>{client.fidelityPoints.toLocaleString('pt-BR')} pontos</strong> acumulados
                  </p>
                  <div className="w-full bg-on-tertiary-fixed/10 h-3 rounded-full overflow-hidden mb-6">
                    <div
                      className="bg-tertiary-container h-full rounded-full"
                      style={{ width: `${Math.min((client.fidelityPoints / 3000) * 100, 100)}%` }}
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
                  <button className="bg-primary-container text-on-primary-container px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-sm hover:brightness-110 transition-all">
                    <span className="material-symbols-outlined">assignment_return</span>
                    Registrar Devolução
                  </button>
                </div>
                <div className="text-center py-10 text-on-surface-variant">
                  <span
                    className="material-symbols-outlined block mb-2 text-outline"
                    style={{ fontSize: '48px' }}
                  >
                    propane_tank
                  </span>
                  <p className="text-body-md">Nenhum vasilhame emprestado registrado.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
