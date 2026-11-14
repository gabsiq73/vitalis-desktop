# Publicar o Vitalis no GitHub Releases

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
