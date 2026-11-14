# Vitalis Desktop

Cliente desktop do Vitalis, ERP local para a operação de uma distribuidora de água e gás. O aplicativo é desenvolvido em React e distribuído com Electron; ele consome a API local do repositório [vitalis](https://github.com/gabsiq73/vitalis).

Ele foi desenhado para o uso diário do depósito, não como aplicação web pública ou SaaS.

## Funcionalidades disponíveis

- Dashboard com pedidos recentes, entregas e alertas de estoque.
- Pedidos de água e gás, com entrega, retirada, edição, cancelamento e confirmação de entrega.
- Clientes, preços personalizados, histórico de pedidos, fiados e saldo de crédito.
- Produtos, estoque, fornecedores e vasilhames.
- Garrafões devidos aos clientes, com cadastro, filtro por cliente e baixa integral em Vasilhames.
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

## Primeira utilização

Com a API local em execução, clique em **Criar conta** na tela de login.
Informe nome, sobrenome opcional, nome de usuário, email, senha (mínimo de
6 caracteres), confirmação e perfil **Administrador** ou **Vendedor**.
O cadastro permite criar a primeira conta e outros administradores sem login,
convite, SQL ou conta padrão. Após o sucesso, o login recebe o nome de usuário
preenchido; informe sua senha para entrar pelo HTTP Basic existente.

O cadastro usa `POST /users` sem Authorization e não persiste senha nem
confirmação como rascunho. Requer o tratamento de duplicidade e validação do
backend da issue `gabsiq73/vitalis#12`. Erros preservam o formulário para correção;
API indisponível recebe mensagem distinta. **Usuários → Novo Usuário** reutiliza
o formulário e mantém a sessão de quem está operando.

Teste dirigido das validações de usuário:
`node --experimental-strip-types --test tests/userValidation.test.mjs`.
O teste `node tests/registration.electron.mjs` requer Playwright instalado,
`npm run dev` em `localhost:5173` e API local. Usa perfil Electron separado,
cria contas temporárias e as remove ao terminar. `PLAYWRIGHT_MODULE` aceita
o módulo de uma instalação existente. Para verificar a primeira conta em uma
API descartável com banco vazio, informe `REGISTRATION_TEST_API` com seu endereço
e `REGISTRATION_EXPECT_EMPTY=1`; só o teste encaminha as requisições a essa API.
O endereço do aplicativo continua fixo em `http://localhost:8080`.

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

As telas e os arquivos exportados usam nomes da operação, como Varejo, Revenda,
Água, Gás, Administrador e Vendedor. A importação aceita esses nomes e mantém
compatibilidade com os códigos dos arquivos antigos. Mensagens e conferência
do caixa usam linguagem do operador, sem exibir detalhes da integração.
Teste dirigido: `node --experimental-strip-types --test tests/importTypes.test.mjs`.
O fluxo completo é verificado por `node tests/operatorLanguage.electron.mjs`, com
Playwright, desktop em `localhost:5173` e uma API real descartável informada em
`OPERATOR_LANGUAGE_TEST_API`.

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

Em **Estoque → Garrafões do depósito**, informe a contagem física inicial de válidos
e vencidos (vazios e cheios). A quantidade de água cheia usa parte dos válidos;
o restante é mostrado como válido vazio. Os estoques anteriores ficam preservados
até informar essa contagem. Para realocar água entre produtos, reduza uma alocação
e aumente outra, sem exceder os garrafões válidos disponíveis.

No item de água do pedido, selecione **Troca de água**, **Garrafão completo** ou
**Vencido, sem água** e informe o preço da venda. A entrega de troca baixa apenas
a água; completo baixa água e total válido; vencido baixa apenas o total vencido.
Cancelamento recompõe os efeitos aplicados. Vencidos não contam como água vendida.
O cadastro de empréstimos continua separado da alocação física de águas.

**Pedidos → Promoção Gás + água** permite escolher água, valor de referência, custo
do gás e preço do conjunto. Uma promoção de R$ 127 com custo de gás R$ 110 e água
de referência R$ 9 gera margem de gás R$ 8. Se a água vale R$ 8, a margem é R$ 9.
Quando o entregador recebe, o repasse é R$ 17 (água + margem). A água é inclusa,
sem segunda cobrança, e baixa normalmente na entrega. Pedidos comuns mistos
continuam gerando seus subpedidos; a promoção mantém gás e água juntos.

Pedidos concluídos podem ser corrigidos pela lista ou pelo detalhe. O formulário
mantém cliente, IDs e linhas existentes, permitindo corrigir produto do mesmo tipo,
quantidade, preço, custo do gás, recebedor, data e observação. Estoque e acertos são
recalculados na mesma transação. Pagamentos avulsos recebidos a mais viram crédito,
mantendo o total recebido no caixa. Acertos já liquidados podem editar valor,
data, meio e situação; empréstimos pendentes podem editar cliente, produto,
quantidade e data. Os registros são atualizados sem excluir e recriar.

Requer os contratos `/bottle-inventory`, `/orders/{id}/correction`,
`PUT /gas-settlements/{id}`, `PUT /bottles/{id}`, `bottleMode` e `promotion` do backend.
Atualize o backend antes do desktop. Teste dirigido do fluxo:
`node tests/correctionsBottlesPromotion.electron.mjs`, com Playwright e
`OPERATION_CORRECTIONS_TEST_API` apontando para uma API real descartável.

A tela de Pedidos pesquisa por cliente, número exibido (com ou sem `#`) ou
observação em todas as páginas, respeitando os filtros de data, entrega e pagamento.
Selecione **Todos** nas datas para procurar pedidos antigos. As observações aparecem
na própria linha, com largura e altura limitadas e rolagem para textos longos.

Em **Fiados → Registrar fiado**, cadastre o saldo ainda devido do caderno, com
cliente, valor, data original e observação opcional. O cadastro não gera venda,
estoque, acerto de gás ou recebimento. Ele aparece no histórico e nos pagamentos
do cliente como **Fiado antigo**; o recebimento usa o fluxo existente, inclusive
pagamento parcial e crédito excedente. Requer o backend com
`GET /orders?search=...`, `POST /orders/manual-debts` e `manualDebt` na resposta.
Atualize o backend antes do desktop. Validação dirigida do lote:
`node tests/ordersAndDebts.electron.mjs` com Playwright disponível e
`ORDERS_DEBTS_TEST_API` apontando para uma API real descartável.

Lote validado em 14/11/2026: lint, TypeScript, build com empacotamento Windows,
19 testes de relatórios/pagamentos/caixa e teste Electron com a API real em H2
descartável. A verificação visual cobriu 1440 e 1024 pixels, observação longa,
busca fora da primeira página, cadastro e pagamento parcial de fiado.
O teste do backend cobre também quitação, excedente, FIFO por data original,
validações e cancelamento. PostgreSQL e banco operacional não foram utilizados.

No pedido, o campo de preço unitário da água permite informar um valor combinado
somente para aquela venda. O valor manual positivo é enviado como `unitPrice`,
prevalece sobre preço do produto, preço fixo do cliente, revenda e desconto de
retirada e atualiza total e pagamento sugerido. Na criação, deixe o campo em branco
para voltar ao cálculo habitual. O preço permanece no
rascunho e no pedido gravado, sem alterar cadastros. Na edição,
deixar o campo em branco mantém o preço já gravado; itens históricos a zero
continuam preservados. Concluídos usam o formulário de correção; cancelados não
permitem alteração de itens.

Teste do fluxo no Electron: `node tests/waterPrice.electron.mjs`, com Playwright
instalado (ou `PLAYWRIGHT_MODULE`), desktop em `localhost:5173` e
`WATER_PRICE_TEST_API` apontando para uma API real descartável com banco vazio.
O teste cria seus próprios clientes, produtos, estoque e pedidos somente nessa API.

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

Na lista de pedidos, o pagamento é revisado pelo botão de confirmar entrega;
o ícone separado de registrar pagamento foi removido. Dashboard, lista e detalhe
reutilizam `AddPaymentModal` quando o pedido ainda não está pago. O operador
pode receber o valor ou escolher **Registrar fiado**, mantendo a dívida sem criar
pagamento/entrada no caixa. Pagamento parcial mantém o modal aberto para receber
o restante ou escolher fiado. Após essa etapa, a confirmação de entrega existente
continua, preservando a revisão do gás; pedidos pagos seguem diretamente para ela.

Pagamento `PENDING` aparece como “Aguardando” antes da entrega e como “Fiado”
somente depois da entrega confirmada com valor em aberto. Escolher **Registrar fiado**
e cancelar a confirmação ainda mantém “Aguardando”. Não há novo método de pagamento
ou enum no backend. O filtro “Em aberto” inclui ambos; Relatórios os separa.
A confirmação da entrega torna
o saldo em aberto uma dívida do cliente. Para receber depois de uma entrega fiada,
o registro de pagamento permanece disponível no detalhe do pedido. Os endpoints
de pagamento e entrega são separados: se o pagamento for registrado e a entrega
falhar ou for cancelada pelo operador, o valor continua registrado e não é cobrado
novamente ao retomar o fluxo. Uma falha após parcela registrada exige atualizar
o saldo antes de tentar novamente. Teste de rótulos:
`node --experimental-strip-types --test tests/paymentStatusLabel.test.mjs`.
Teste do fluxo no Electron: `node tests/paymentStatus.electron.mjs`, com
Playwright (ou `PLAYWRIGHT_MODULE`), desktop em `localhost:5173` e
`PAYMENT_STATUS_TEST_API` apontando para uma API real descartável. O teste
verifica a escolha de fiado cancelada e a entrega efetivamente confirmada.

Os alertas de estoque no Dashboard, em Estoque e em Relatórios seguem a mesma
regra: zerado, no mínimo/abaixo do mínimo, ou normal. `GET /stocks` deve retornar
somente estoque físico de água, filtrando registros legados de gás antes da
paginação. Atualize o backend com esse filtro para evitar que um gás oculto na
tela de Estoque gere um falso alerta no Dashboard. Teste dirigido:
`node --experimental-strip-types --test tests/stockStatus.test.mjs`.

A confirmação de entrega no Dashboard, na lista e no detalhe de pedidos abre
uma revisão do recebimento do gás. A seleção existente é preservada: o operador
pode manter o entregador como recebedor ou informar recebimento pelo depósito
em PIX/Dinheiro. O desktop envia os IDs dos itens em `gasPayments` no corpo de
`PATCH /orders/{id}/confirm-delivery`; requer o backend com esse contrato para
salvar pagamento, acerto e entrega na mesma transação. Pagamentos parciais
legados são preservados; alterações de recebedor com pagamentos avulsos ou
acertos já liquidados são recusadas pelo backend.

No Caixa do Dia, **Vendas entregues (valor bruto)** usa `depotDeliveredSales` do
relatório diário: exclui o gás recebido pelo entregador e inclui o valor bruto do
gás recebido pelo depósito. Margens e acertos seguem separados; o faturamento
geral (`totalInvoiced`) continua incluindo todas as vendas entregues.

Relatórios e Caixa do Dia distinguem valor bruto vendido, dinheiro recebido no
depósito e margem do gás. A margem entregue pode estar pendente de repasse:
ela não é uma entrada adicional de caixa. Os movimentos de acertos no livro-caixa
já trazem `amount` totalizado pela quantidade; a listagem de Acertos de Gás
continua recebendo `amount` unitário. Não multiplique movimentos de caixa novamente.

A seção “Garrafões devidos aos clientes” de Vasilhames usa
`POST /depot-bottle-debts`, `GET /depot-bottle-debts?clientId=...&page=0&size=15`
e `PATCH /depot-bottle-debts/{id}/complete`. Requer o backend com o contrato da
issue `gabsiq73/vitalis#2`. A listagem mostra somente pendências; a baixa integral
retira o registro da lista, preservando seu histórico no backend. Esses registros
não compõem empréstimos, estoque ou saldos financeiros. Quantidade inteira
positiva, cliente e data são obrigatórios; a observação aceita até 255 caracteres.

O Caixa do Dia consulta `GET /payments/daily?date=YYYY-MM-DD&includeBalance=true`.
Esta versão requer o backend com suporte a `includeBalance` para mostrar o uso
de SALDO na data do pagamento. PIX e Dinheiro incluem as linhas `CLIENT_CREDIT`
e compõem as novas entradas; SALDO é apresentado separadamente como crédito
utilizado, fora do total e do gráfico de recebimentos. Falhas da lista deixam
totais e contagens indisponíveis até uma nova consulta. Teste dirigido:
`node --experimental-strip-types --test tests/dailyCashTotals.test.mjs`.

O livro-caixa usa os detalhes `cashMovements` e `gasSettlementMovements` do
financeiro diário. **Saldo do Caixa** usa `cashBalance`, apenas dinheiro físico;
**Saldo do PIX** usa `pixBalance`. Recebimentos incluem créditos novos de clientes,
mas SALDO utilizado não é nova entrada. `finalBalance` permanece como total
combinado no contrato e não é usado para conferir o dinheiro físico.
Administradores podem registrar entrada, retirada com motivo e ajuste em
`POST /cash-movements`. A direção é enviada somente para ajustes; nas respostas,
entradas e retiradas têm direção nula e seu sinal é determinado pelo tipo.
A conferência compara o valor contado com `cashBalance` da data selecionada.
Entradas, retiradas e ajustes manuais movimentam apenas dinheiro físico.
Acertos individuais ou por distribuidora exigem escolher PIX ou Dinheiro e alteram
apenas o saldo escolhido, na data da liquidação. `paymentMethod` aparece nos
acertos e no livro-caixa. Registros antigos sem meio informado ficam separados,
com aviso no caixa; use **Informar meio do acerto antigo** em Acertos de Gás para
classificá-los preservando sua data. A diferença zero não gera lançamento; se a base
mudar antes de confirmar, o operador deve revisá-la. Exclusão de movimentos e
mudanças nas regras de fechamento não fazem parte desse fluxo.
Teste dirigido: `node --experimental-strip-types --test tests/cashMovement.test.mjs`.

A busca por nome em Clientes e Novo Pedido ignora acentos e maiúsculas no backend,
antes da paginação e preservando os filtros de tipo e clientes ativos. Não exige
extensão PostgreSQL ou alteração dos nomes cadastrados. Atualize o backend antes
do desktop: acertos exigem `paymentMethod=PIX|DINHEIRO` nos endpoints de liquidação,
e o financeiro diário acrescenta os saldos separados e a contagem de acertos antigos.
Teste completo: `node tests/cashMethodsAndSearch.electron.mjs`, com Playwright e
`CASH_METHODS_TEST_API` apontando para uma API real descartável.

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
