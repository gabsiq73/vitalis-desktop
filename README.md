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

Na confirmação de entrega, **Registrar Pagamento → Registrar empréstimo de
vasilhame** permite informar a quantidade adicional emprestada ao cliente do
pedido. A opção também aparece em pedidos pagos e no fluxo de fiado. O empréstimo
é gravado junto com a entrega; cancelar a confirmação não registra vasilhames.
Empréstimos já vinculados ao pedido são informados para evitar duplicação.

O menu **Contas a receber** substitui o nome Fiados, preservando cadastro e
recebimento das dívidas. Pesquisas em Pedidos e Clientes e buscas locais de
Contas a receber, Produtos e Fornecedores ignoram acentos, caixa e espaços.
Pedidos oferece um seletor com todos os produtos, inclusive inativos; o filtro
vale para todas as páginas e combina com pesquisa, data e situação. Água usada
em garrafão completo ou troca de vencido também pode ser filtrada pelo produto.

No **Caixa do Dia → Alterar forma** e no **Detalhe do pedido → Pagamentos →
Alterar forma de pagamento**, é possível corrigir PIX/Dinheiro mesmo após a
quitação e entrega. ID, valor, data e quitação são preservados; o caixa da data
original e o crédito excedente vinculado refletem a correção. SALDO utilizado
continua separado dos recebimentos.

Requer a API com `loanedBottleQuantity` opcional em
`PATCH /orders/{id}/confirm-delivery`, `productId` em `GET /orders` e
`PATCH /payments/{id}/payment-method` com `{paymentMethod: "PIX" | "DINHEIRO"}`.
Não há alteração de schema. Atualize backend e desktop juntos.
Teste dirigido: `node tests/deliverySearchPaymentCorrection.electron.mjs`,
com desktop em 5173, Playwright e
`DELIVERY_CHANGES_TEST_API=http://127.0.0.1:18093` apontando para uma API
descartável. `node --experimental-strip-types --test tests/search.test.mjs`
verifica a normalização das buscas locais.

Validação deste fluxo: 16 testes novos de API (8 H2 + 8 PostgreSQL 16),
regressões dirigidas de busca/fiados, 15 testes de busca/pagamento/caixa do
desktop, lint, build Windows e Electron com API real descartável em 1440 e
1024 pixels. Postman confirmou a busca de cliente com duas asserções.

**Produtos → Excluir** exige digitar exatamente **Excluir produto**. Apaga o
cadastro errado, seu estoque e preços personalizados. Produtos com histórico
vinculado recebem orientação para desativar, preservando os registros.

**Fiados → cliente → Editar fiado**, nas abas Pedidos ou Pag. em Lote,
permite corrigir valor total,
data e observação. Mantém cliente, ID e pagamentos; se o novo total for menor
que o já pago, a diferença vira crédito sem duplicar recebimentos no caixa.
Requer `PUT /orders/manual-debts/{id}` com o mesmo DTO do cadastro.

**Estoque → Registrar compra de garrafões** permite comprar vazios ou cheios,
selecionando a água. Aumenta o total válido e, quando cheio, também aquela água.
Exige contagem inicial e mantém histórico com operador, data e observação.
Não registra pagamento automaticamente. Requer migration V7 e
`POST/GET /bottle-inventory/purchases` da API. O teste
`node tests/operationalAdjustments.electron.mjs` usa desktop em 5173, Playwright
e `OPERATIONAL_ADJUSTMENTS_TEST_API=http://127.0.0.1:18092` descartável.

Em **Estoque → Garrafões do depósito → Registrar quebra**, informe se o
garrafão é válido ou vencido e a quantidade. Para garrafão cheio, marque essa
opção e escolha a água: a mesma quantidade sai da água e dos garrafões.
Para vazio, somente os garrafões saem. Não há venda ou movimentação de caixa.
O resumo mostra totais quebrados por categoria e o Histórico de quebras mantém
data, quantidade, observação e operador. Exige contagem física inicial.

Requer a API com V6 e `POST/GET /bottle-inventory/breakages`; o resumo acrescenta
`brokenValidQuantity` e `brokenExpiredQuantity`. A migration cria o histórico
sem modificar os dados existentes. Teste dirigido:
`node tests/bottleBreakage.electron.mjs`, com Electron/Vite em 5173,
Playwright e `BOTTLE_BREAKAGE_TEST_API=http://127.0.0.1:18090` descartável.

Em **Relatórios**, o card **Garrafões no período** mostra completos vendidos
pela data de entrega e quebras pela data do registro, com divisão entre válidos
e vencidos. Acompanha os filtros de 7/30/90 dias; não inclui trocas ou pedidos
cancelados nas vendas. Requer `GET /reports/bottles?start=...&end=...`, retornando
`fullBottlesSold`, `brokenBottles`, `brokenValidBottles`, `brokenExpiredBottles`.
Teste real: `node tests/bottleReport.electron.mjs`, com desktop/Vite em 5173,
Playwright e `BOTTLE_REPORT_TEST_API=http://127.0.0.1:18091` descartável.

Na ficha de **Clientes**, use **Adicionar saldo** para registrar um recebimento
em reais por PIX ou Dinheiro. O valor quita primeiro os fiados mais antigos,
como o pagamento em lote; o restante fica disponível para os próximos pedidos
com o meio **Saldo**. O recebimento entra no Caixa do Dia uma única vez.

Em **Promoção Gás + água**, **Destino da água** permite entregar junto ou deixar
água em crédito. A opção de crédito mantém o gás e uma entrega de água já paga
separados, sem baixar água do estoque na entrega do gás. Na ficha do cliente,
**Águas da promoção em crédito → Resgatar água** permite entregar uma parte ou
toda a quantidade, após concluir a entrega do gás, sem nova cobrança.
O detalhe do resgate permite desfazê-lo, devolvendo água ao estoque e ao crédito.
Cancelar ou apagar a promoção de gás também desfaz seus créditos e resgates;
a confirmação de exclusão informa essa abrangência.

Vasilhames emprestados aparecem antes dos garrafões devidos aos clientes.

Requer os endpoints `POST /payments/credits/{clientId}`,
`GET /orders/client/{id}/water-credits` e `POST /orders/{id}/redeem-water`.
`promotion.waterAsCredit` é opcional (padrão: entregar junto).
`OrderResponseDTO` acrescenta `waterCredit` e `deferredWaterPromotion`.
Não exige mudança de schema, migrations nem alterações nos registros antigos.
Teste: `node tests/clientCreditAndPromotion.electron.mjs`, com Playwright,
desktop em 5173 e `CLIENT_CREDIT_TEST_API=http://127.0.0.1:18089` descartável.

Em **Produtos → Novo Produto**, escolha **Garrafão completo** ou **Garrafão
vencido** para cadastrá-los com nome e preço próprios. No pedido, o completo pede
a água que vai nele; seu preço é o valor completo da venda, sem segunda cobrança
pela água. A entrega reduz uma água escolhida e um garrafão válido por unidade.
No produto vencido, escolha **Venda do vasilhame** para reduzir os vencidos ou
**Troca de água** e selecione a água utilizada. A troca baixa somente a água,
mantendo os totais de garrafões válidos e vencidos. A opção também está disponível
na edição e na correção de pedidos concluídos; cancelamento recompõe a água.
Requer o backend com suporte a `EXPIRED_BOTTLE` + `bottleMode: REFILL` e
`waterProductId`. Vendas antigas continuam como venda do vasilhame.
Teste dirigido: `node tests/expiredRefill.electron.mjs`, com desktop em
`localhost:5173`, Playwright (ou `PLAYWRIGHT_MODULE`) e
`EXPIRED_REFILL_TEST_API` apontando para uma API real descartável.
Requer a migration V5 e `waterProductId` no item. Pedidos antigos continuam válidos.

No pedido de gás, o campo de preço agora altera o **preço de venda**. O custo vem
de **Produtos → Último Custo** e fica congelado na venda. A promoção também usa
o custo cadastrado, mantendo preço do conjunto e água ajustáveis.

Em **Acertos de Gás → Editar**, os preços unitários de custo e de venda podem
ser corrigidos, inclusive em acertos liquidados. A correção atualiza o pedido,
seu histórico, pagamentos e acerto na mesma transação, preservando os cadastros.
Na promoção, o preço de venda é o valor do conjunto.

**Apagar pedido**, na lista ou no detalhe, exclui definitivamente o pedido
selecionado, seus itens, pagamentos, empréstimos e acertos. **Apagar acerto de gás**
exclui também o pedido vinculado inteiro, conforme a confirmação exibida.
O estoque é recomposto, SALDO utilizado é devolvido e o saldo do cliente é
recalculado. Outros subpedidos de uma venda mista são mantidos. Pedidos já
cancelados também podem ser apagados, sem recompor estoque novamente.
A exclusão exige administrador; o cancelamento anterior continua disponível.

Requer o backend com `salePrice` e `costPrice` opcionais em
`PUT /gas-settlements/{id}`, `DELETE /gas-settlements/{id}` e
`DELETE /orders/{id}/permanent`. Atualize backend e desktop juntos.
Teste do fluxo: `node tests/gasPricesAndDeletion.electron.mjs`, com desktop em
`localhost:5173`, Playwright (ou `PLAYWRIGHT_MODULE`) e
`GAS_OPERATIONS_TEST_API` apontando para uma API real descartável.

**Vasilhames → Registrar Empréstimo** pede somente cliente e quantidade; a data
é automática e não é necessário ter água/produto cadastrado. No Novo Pedido,
ative **Registrar empréstimo** e informe somente a quantidade para o cliente
já selecionado. Edição preserva a data e o produto dos empréstimos históricos.
Requer o backend com a migration V4 e `productId` opcional em `/bottles`.
Novos registros sem produto aparecem como **Garrafão**. Devolução e exclusão
mantêm seus fluxos existentes.

Em **Estoque → Garrafões do depósito**, informe a contagem física inicial de válidos
e vencidos (vazios e cheios). A quantidade de água cheia usa parte dos válidos;
o restante é mostrado como válido vazio. Os estoques anteriores ficam preservados
até informar essa contagem. Para realocar água entre produtos, reduza uma alocação
e aumente outra, sem exceder os garrafões válidos disponíveis.

Produtos de água comum não mostram o seletor de operação no pedido, na edição
ou na correção. Use os produtos **Garrafão completo** e **Garrafão vencido** para
as opções de vasilhame. A troca baixa apenas a água; completo baixa água e total
válido; a venda do vasilhame vencido baixa apenas o total vencido. Cancelamento
recompõe os efeitos aplicados. A venda do vencido não conta como água vendida.
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

**Fechamento** consulta `GET /reports/closing?year=...&month=...` (administrador).
Conta vendas concluídas na data da entrega, inclusive fiadas, sem repetir a venda
ao receber o pagamento. Vendas água é o preço de venda total sem descontar custo;
Vendas gás é venda menos custo congelado do item. Compras são pagamentos de boletos
de água classificados como Compra de água no Caixa do Dia. Despesas e retiradas
também vêm do caixa. Saldo do dia = (água − compras) + margem do gás − despesas.
Retirada soma as retiradas do Caixa do Dia e é apenas demonstrativa no fechamento;
saldo do mês acumula os saldos diários desde o início do mês.
Todos os cálculos vêm da API; o desktop apenas formata. A tabela separa vendas,
saídas e resultado, mantém a data visível na rolagem horizontal e destaca saldos
e totais. Textos explicativos e observações mensais não são exibidos na tela.
No Caixa do Dia, **Registrar retirada** mantém o padrão antigo e permite escolher
Compra de água (boleto) ou Despesa e dinheiro/PIX. A listagem mostra tipo e meio da saída.
Requer as novas migrations do backend, sem editar a V1 nem alterar dados antigos.

Teste dirigido: `node tests/closing.electron.mjs`, com Playwright
(`PLAYWRIGHT_MODULE` aceita uma URL de arquivo no Windows), desktop em
`localhost:5173` e `CLOSING_TEST_API=http://127.0.0.1:18087` apontando para uma
API descartável e vazia. Valida água bruta, margem do gás, fiado sem duplicar
recebimentos, compras/despesas/retiradas, acumulado e registro de boleto PIX.

Login/cadastro só são liberados após `/health` responder UP. Falha em 60 segundos
mostra erro, logs e botão de nova tentativa. Os logs da instalação ficam na pasta
`logs` dentro dos dados do Vitalis; a tela mostra o caminho completo.

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

## Instalador Windows 11 x64

### Versão 1.1.2

Adiciona os filtros PIX e Dinheiro ao Caixa do Dia. Os botões ficam à direita
do título Movimentações e filtram os recebimentos e o livro-caixa. O subtotal
de novas entradas acompanha o meio selecionado.

O livro-caixa permite apagar entradas e retiradas com confirmação. O saldo
do meio de pagamento é recalculado a partir dos lançamentos registrados.

### Versão 1.1.1

Remove o filtro de pagamento em Pedidos e o card Saldo Total da Carteira em
Clientes. Inclui a API atual e as migrations V1 a V7, sem migration adicional.
Lint, TypeScript, build e abertura do pacote Windows foram verificados; a
configuração e os registros das 18 tabelas da cópia de teste foram preservados.
Para publicar, envie o instalador 1.1.1, seu `.blockmap` e o `latest.yml` da
mesma compilação. Faça um backup recente antes de atualizar uma instalação.

No backend, com JDK 21 x64 e PowerShell 7, gere o JAR e o runtime em uma pasta nova.
Na primeira compilacao, use desktop-runtime na raiz do checkout desktop.

```powershell
pwsh -File scripts/build-desktop-runtime.ps1 -Destination <checkout-desktop>/desktop-runtime
```

No desktop, rode npm ci e npm run build -- --win nsis --x64 --publish never.
O instalador fica em `release/<versão>/Vitalis-Windows-<versão>-Setup.exe`.
Entregue `scripts/setup-pc.ps1` somente para a primeira instalação do banco.

No PC do usuario, abra PowerShell como administrador na mesma conta Windows
que usara o app e execute .\setup-pc.ps1. O script usa o pacote oficial EDB
via winget, exige internet e elevacao e assume a pasta padrao PostgreSQL\16.
Com servidor Windows ja instalado, informe a senha administrativa quando
solicitada e use -Port se a porta for diferente de 5432. A instalacao silenciosa
passa a senha administrativa temporaria ao instalador pela linha de comando,
visivel a administradores e ferramentas de auditoria do Windows durante a instalacao.
A conta vitalis tem uma senha separada, gravada no perfil Windows do usuario.
O script recusa adotar um banco preexistente sem configuracao correspondente.

Execute o instalador do Vitalis e abra pelo menu Iniciar. Configuracao, logs
e ate sete backups automaticos ficam em %APPDATA%\Vitalis. O PostgreSQL roda
como servico do Windows. Confira a restauracao de um backup em um banco separado
antes de usar o app com dados reais.

### Atualizar uma instalação existente

A versão **1.0.9** inclui a API atual e mantém os recursos e migrations V1 a V7
da 1.0.8. O pacote foi validado em PostgreSQL 16 separado: transição da API 1.0.8
para o aplicativo empacotado 1.0.9, fluxos de entrega/pagamento/busca e preservação
de configuração e registros. Uma cópia do backup local de 15/11/2026 também foi
atualizada, preservando todas as linhas e campos existentes de 15 tabelas.
Essa conferência não substitui um backup recente do PC que será atualizado.

Para publicar a atualização, envie os três arquivos da mesma compilação:
`Vitalis-Windows-1.0.9-Setup.exe`, o respectivo `.blockmap` e `latest.yml`.
O hash SHA-512 do instalador deve coincidir com o manifesto. Não inclua o script
de instalação inicial do banco como etapa de uma atualização.

Feche o Vitalis e faça um backup completo e recente antes da atualização.
Valide a atualização restaurando esse backup em PostgreSQL separado e comparando
os registros antigos após as migrations. O instalador deve incluir a API atual,
gerada pelo script acima, e usar um número de versão novo.

No PC que já usa o sistema, execute o instalador novo na mesma conta Windows,
mantendo a instalação e o PostgreSQL existentes. Não execute `setup-pc.ps1`
novamente, não desinstale o banco e não restaure o backup sobre o banco em uso.
O aplicativo mantém `%APPDATA%\Vitalis\config.json` e aplica as migrations na
primeira abertura. Entre com o usuário existente e confira clientes, pedidos,
fiados, estoque e acertos. Se houve lançamentos desde o backup validado, faça
outro backup imediatamente antes de instalar.
