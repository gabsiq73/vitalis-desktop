# Vitalis Desktop

Cliente desktop do Vitalis, ERP local para a operação de uma distribuidora de água e gás. O aplicativo é desenvolvido em React e distribuído com Electron; ele consome a API local do repositório [vitalis](https://github.com/gabsiq73/vitalis).

Ele foi desenhado para o uso diário do depósito, não como aplicação web pública ou SaaS.

## Funcionalidades disponíveis

- Dashboard com pedidos recentes, entregas e alertas de estoque.
- Pedidos de água e gás, com entrega, retirada, edição, cancelamento e confirmação de entrega.
- Clientes, preços personalizados, histórico de pedidos, fiados e saldo de crédito.
- Produtos, estoque, fornecedores e vasilhames.
- Acertos de gás, Caixa do Dia, relatórios e usuários.

> Pontos e brindes de fidelidade ainda aparecem no código por legado, mas estão planejados para remoção. Não use esse fluxo como base para novas telas.

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

## Projeto backend

Banco e instruções da API estão no repositório [vitalis](https://github.com/gabsiq73/vitalis).
