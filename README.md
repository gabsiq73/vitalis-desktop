# Vitalis Desktop

Cliente desktop do Vitalis, ERP local para a operação de uma distribuidora de água e gás. O aplicativo é desenvolvido em React e distribuído com Electron; ele consome a API local do repositório [vitalis](https://github.com/gabsiq73/vitalis).

Ele foi desenhado para o uso diário do depósito, não como aplicação web pública ou SaaS.

## Funcionalidades disponíveis

- Dashboard com pedidos recentes, entregas e alertas de estoque.
- Pedidos de água e gás, com entrega, retirada, edição, cancelamento e confirmação de entrega.
- Clientes, preços personalizados, histórico de pedidos, fiados e saldo de crédito.
- Produtos, estoque, fornecedores e vasilhames.
- Acertos de gás, Caixa do Dia, relatórios e usuários.

> O programa de fidelidade foi descontinuado. Saldo de crédito financeiro e pagamentos com SALDO continuam disponíveis.

## Stack

- React 18 e TypeScript
- Vite e Electron
- React Router com `HashRouter`
- Axios, Tailwind CSS e Recharts

## Pré-requisitos

- Node.js e npm
- A API Vitalis em execução local em `http://localhost:8080`

## Executando em desenvolvimento

```powershell
npm install
npm run dev
```

O plugin do Vite inicia o processo principal do Electron. Faça login com um usuário existente no backend.

## Build e verificação

```powershell
npm run lint
npm run build
```

O build verifica os tipos, gera o bundle web, compila o Electron e executa o `electron-builder`.

Teste dirigido das métricas de Relatórios (pedidos cancelados, filtros de período,
ticket médio e taxa de entrega):
`node --experimental-strip-types --test tests/orderReport.test.mjs`.

## Estrutura

```text
electron/             # Processo principal e preload do Electron
src/
├── api/              # Cliente HTTP autenticado
├── components/       # Componentes reutilizáveis
├── contexts/         # Autenticação e notificações globais
├── hooks/            # Comportamentos compartilhados
├── modals/           # Fluxos de criação e edição
├── pages/            # Páginas associadas às rotas
├── types/            # Contratos TypeScript espelhando a API
└── utils/            # Formatação, ordenação, rascunho e erros de API
```

## Integração com a API

O endereço da API está centralizado em `src/api/http.ts`:

```ts
const BASE_URL = 'http://localhost:8080';
```

A autenticação usa HTTP Basic e a sessão é guardada localmente. Respostas paginadas usam `SpringPage<T>`, definido em `src/types/index.ts`; atualize esse tipo e seus consumidores quando o contrato do backend mudar.

## Navegação

As rotas protegidas estão em `src/App.tsx`. A barra lateral oferece Dashboard, Pedidos, Clientes, Caixa do Dia, Produtos, Estoque, Fornecedores, Vasilhames, Fiados, Acertos de Gás, Relatórios, Usuários e Configurações.

O app usa `HashRouter` para funcionar no Electron carregado a partir de arquivo. Não o substitua por `BrowserRouter` sem adaptar o empacotamento.

## Regras de integração importantes

- Pedidos mistos podem gerar múltiplos pedidos no backend; a interface deve lidar com a lista retornada na criação.
- Dinheiro/PIX recebido, crédito do cliente, uso de saldo e fiado são conceitos financeiros distintos.
- A confirmação de entrega efetiva a baixa de estoque da água.
- Acertos de gás são movimentações financeiras com fornecedores, não estoque local.

Na criação, o modal envia as parcelas em `POST /orders` por meio do campo opcional
`initialPayments: [{ amount, paymentMethod }]`, com métodos `PIX`, `DINHEIRO` e
`SALDO`. O backend registra pedido(s) e pagamentos em uma única transação e mantém
o retorno em lista. Esta versão do desktop requer o backend com suporte a esse campo;
atualize o backend antes do desktop.

A seção de pagamento opcional cobre a água, inclusive pagamento parcial ou combinado.
O gás recebido pelo depósito usa o método selecionado no item e é incluído na mesma
requisição; o backend deduz o pagamento automático por método, evitando duplicidade.
Gás recebido pelo entregador não gera parcela recebida no depósito. Pagamentos avulsos
de pedidos existentes continuam usando os endpoints de pagamentos.

Empréstimos de vasilhames continuam separados. Se falharem após a criação, o pedido
e seus pagamentos permanecem registrados; o modal fecha e exibe uma notificação
orientando registrar o empréstimo pela tela de vasilhames.

## Projeto backend

O Caixa do Dia consulta `GET /payments/daily?date=YYYY-MM-DD&includeBalance=true`.
Esta versão requer o backend com suporte a `includeBalance` para mostrar o uso
de SALDO na data do pagamento. PIX e Dinheiro incluem as linhas `CLIENT_CREDIT`
e compõem as novas entradas; SALDO é apresentado separadamente como crédito
utilizado, fora do total e do gráfico de recebimentos. Falhas da lista deixam
totais e contagens indisponíveis até uma nova consulta. Teste dirigido:
`node --experimental-strip-types --test tests/dailyCashTotals.test.mjs`.

O contrato coordenado da descontinuação remove `fidelityPoints` e
`pendingBonusWater` de clientes e `pointsPerWaterItem`/`pointsPerFreeWater` de
configuração. `/config` mantém `pickupDiscountCents`. Atualize backend e desktop
juntos, seguindo o procedimento para bancos existentes no `DOCUMENTATION.md`
do backend. A aplicação não chama mais a rota de adição de pontos.

Rascunhos antigos têm seus marcadores de resgate descartados e exigem que o
operador revise itens e totais antes de enviar. Histórico mostra os valores
gravados, inclusive R$ 0,00. Preços especiais, revenda, desconto de retirada,
crédito financeiro e SALDO permanecem disponíveis.

Teste dirigido do rascunho: `node --experimental-strip-types --test tests/orderDraft.test.mjs`.

Banco e instruções da API estão no repositório [vitalis](https://github.com/gabsiq73/vitalis).
