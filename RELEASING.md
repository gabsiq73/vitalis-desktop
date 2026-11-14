# Publicar o Vitalis no GitHub Releases

## Fechamento / 1.0.5

A branch de origem já estava na versão 1.0.5. O fechamento requer o backend
correspondente, com migrations V2 (custos congelados e classificação de saídas)
e V3 (compatibilidade das operações existentes). A V1 permanece intacta.
Leia `FECHAMENTO.md` no backend para as limitações de crédito/adiantamento,
fiado antigo, garrafões e gás recebido pelo entregador.

O login/cadastro aguarda `/health` com status UP. Depois de 60 segundos mostra
erro e nova tentativa, com o caminho de logs. Falhas ao iniciar a API embutida
também mostram erro na janela, logs e botão que reinicia a inicialização.

Nesta entrega o instalador foi adiado pelo dono. Validação sem NSIS/publicação:
`npx tsc && npx vite build`. Quando for autorizado gerar os artefatos, atualize
primeiro o runtime do backend e use `npm run build -- --win nsis --x64 --publish never`.
Gere `.exe`, `.exe.blockmap` e `latest.yml` juntos; compare o SHA-512 em base64
do executável com `sha512` em `latest.yml`. Não reutilize metadados de build anterior.

Testes de lógica: `node --experimental-strip-types --test tests/*.test.mjs`.
Teste Electron/PostgreSQL: `tests/closing.electron.mjs`, API descartável na porta
8084, Vite em 5175, `CLOSING_TEST_API=http://127.0.0.1:8084` e `PLAYWRIGHT_MODULE`
apontando para Playwright instalado. Usa somente o Postgres de teste, nunca a
configuração/dados da instalação operacional.

## Procedimento de publicação

Use Releases do repositorio publico gabsiq73/vitalis-desktop. Um repositorio
separado so vale a pena se for preciso separar permissoes de publicacao.
O destino fica gravado no instalador. Preserve appId e productName.

1. Gere um JAR novo e o Java pelo script build-desktop-runtime.ps1 do backend.
   Coloque os dois em desktop-runtime conforme o README.
2. Aumente a versao com npm version <versao> --no-git-tag-version e revise o diff.
3. No PowerShell 7, defina GH_TOKEN apenas na sessao de publicacao:

   ```powershell
   $env:GH_TOKEN = Read-Host 'Token GitHub com Contents: write no repositorio' -MaskInput
   try {
       npm run build -- --win nsis --x64 --publish always
   } finally {
       Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue
   }
   ```

4. No GitHub, abra o rascunho v<versao>. Confira que ele contem o instalador
   .exe, seu .exe.blockmap e latest.yml, todos do mesmo build. Confira versao,
   destino e notas de release. Clique em Publish release para tornar a versao
   visivel aos clientes. Preserve os arquivos das releases anteriores.
5. Para um ensaio local sem publicacao, use --publish never. O app 1.0.0
   precisa receber manualmente a primeira versao que inclui o atualizador.

O NSIS desta serie usa electron-builder 26 e electron-updater 6. A verificacao
de Authenticode esta desligada para aceitar o instalador sem assinatura. O updater
ainda compara o SHA-512 com o latest.yml servido via HTTPS. Esse checksum depende
da integridade da conta e dos arquivos da release. O Windows pode mostrar
SmartScreen ou bloquear a execucao por politica local. Reavalie a configuracao
de assinatura antes de atualizar as ferramentas para uma nova major.

Ensaio de entrega: instale 1.0.1 por usuario em uma maquina de teste, configure
um PostgreSQL de teste, crie um cadastro e publique 1.0.2 no feed de teste
configurado em ambos os builds. Verifique o dump antes do download, feche pelo
botao ou confirme o reinicio, confirme que o java anterior saiu e confira o
cadastro e o historico do Flyway na nova versao. Repita com a rede desligada e
com pg_dump indisponivel para verificar que o app continua utilizavel.

## 1.0.3: reabertura depois de fechar

O Vitalis remove api.pid quando a API encerra. Se o Windows interromper
o aplicativo antes da limpeza, a proxima abertura verifica o executavel
e o argumento do JAR antes de encerrar um processo anterior. Uma falha nessa
verificacao e registrada no log e a abertura continua.

Para testar a instalacao por cima da 1.0.1, use uma conta e um banco de teste.
Guarde os hashes de config.json e de um backup existente e crie um registro
identificavel no banco. Feche a 1.0.1, instale a 1.0.3 com a mesma conta e
confirme os hashes e o registro. Depois abra e feche tres vezes, teste
encerramento forcado e abra duas instancias. Confira o PID do Java da API
e a remocao de api.pid em cada fechamento normal.
