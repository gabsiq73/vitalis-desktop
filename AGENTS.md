@RTK.md

# Instruções para agentes — Vitalis Desktop

## Propósito e escopo

Este é o cliente desktop local do Vitalis para uma distribuidora de água e gás. Preserve a experiência e os fluxos específicos do depósito; não transforme o projeto em dashboard SaaS genérico, aplicação web hospedada ou arquitetura de estado global desnecessária.

Antes de editar uma tela, leia a página/modal, seus tipos em `src/types`, as chamadas HTTP usadas e o endpoint correspondente no backend. Não invente contratos de API no frontend.

## Arquitetura existente — siga-a

- `src/pages` contém telas e coordena estado local, carregamento e ações da rota.
- `src/modals` concentra formulários e fluxos modais reutilizados.
- `src/components` contém componentes visuais reutilizáveis; extraia um componente apenas quando houver reutilização concreta.
- `src/contexts` é reservado ao estado transversal existente: autenticação e notificações.
- `src/hooks` contém comportamentos compartilhados.
- `src/types/index.ts` é a fonte de verdade dos contratos TypeScript da API.
- `src/utils` concentra formatação, ordenação, rascunhos e tradução de erros HTTP.
- O cliente autenticado vem de `useAuth()`. Não crie instâncias Axios dispersas nem use `fetch` em paralelo.

Não introduza Redux, Zustand, React Query, formulários genéricos, um design system novo, uma biblioteca de componentes ou uma camada de services/repositories no frontend sem pedido explícito.

## Convenções de implementação

- Use componentes funcionais, hooks e TypeScript estrito, como no código existente.
- Mantenha tipos de request/response alinhados ao backend e atualize `src/types/index.ts` quando o contrato mudar.
- Siga o padrão de `loading`, `useEffect`, `useCallback` e `Promise.allSettled` já usado nas páginas.
- Mensagens para o operador são em português e usam `useNotification()` quando o fluxo já usa toast.
- Use `parseApiError` para apresentar erros HTTP e os helpers de `src/utils/format.ts` antes de criar formatação local duplicada.
- Preserve o estilo Tailwind existente, `TopBar`, `ConfirmModal`, modais e Material Symbols.
- Rotas ficam em `src/App.tsx`; entradas da barra lateral, em `src/components/Sidebar.tsx`. Atualize ambos para nova página navegável.
- O app usa `HashRouter`; não troque para `BrowserRouter`.

## Integração e regras de domínio

- A API local está fixa em `src/api/http.ts`: `http://localhost:8080`. Não a substitua por hospedagem ou chamadas externas sem solicitação.
- A sessão usa HTTP Basic e `localStorage`; preserve compatibilidade com esse modelo enquanto o backend o usar.
- Um pedido misto de água e gás pode retornar mais de um pedido criado. Trate o retorno como lista, como o `NewOrderModal` já faz.
- Água tem estoque físico e baixa na confirmação da entrega. Gás gera acertos financeiros, não baixa de estoque local.
- Diferencie dinheiro/PIX recebido, crédito do cliente, uso de saldo e fiado no Caixa do Dia.
- Fidelidade é legado e está planejada para remoção. Não implemente recursos novos que a utilizem.

## Verificação

- Execute `npm run lint` após mudanças TypeScript/React quando possível.
- Execute `npm run build` para mudanças que possam afetar tipagem, Vite ou Electron.
- Não edite `dist-electron/` manualmente: é saída de build e pode conter alterações locais do usuário.
- Preserve alterações não relacionadas no diretório de trabalho, especialmente artefatos de build e lockfiles.
