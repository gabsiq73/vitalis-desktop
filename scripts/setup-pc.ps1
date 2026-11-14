# Run elevated from the Windows account that will use Vitalis.
param([ValidateRange(1,65535)][int]$Port = 5432)
$ErrorActionPreference = 'Stop'
$homeDir = Join-Path $env:APPDATA 'Vitalis'
$configFile = Join-Path $homeDir 'config.json'
$bin = Join-Path $env:ProgramFiles 'PostgreSQL\16\bin'
$psql = Join-Path $bin 'psql.exe'
function New-Password { [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N') }
function Invoke-Database([string]$User, [string]$Database, [string]$Password, [string]$Sql) {
    $previous = $env:PGPASSWORD
    try {
        $env:PGPASSWORD = $Password
        $result = $Sql | & $psql -X -w -qAt -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $Port -U $User -d $Database 2>$null
        if ($LASTEXITCODE) { throw "Falha no PostgreSQL ($User / $Database). Confira a porta, o servico e as credenciais." }
        $result
    } finally { $env:PGPASSWORD = $previous }
}
if (Test-Path $configFile) {
    $existing = Get-Content $configFile -Raw | ConvertFrom-Json
    if ($existing.password) {
        $Port = $existing.port
        Invoke-Database $existing.user 'vitalis' $existing.password 'SELECT 1' | Out-Null
        Write-Host 'Vitalis ja configurado. Banco acessivel.'
        exit
    }
}
if (!(Test-Path $psql)) {
    $adminPassword = New-Password
    Write-Host 'Instalando PostgreSQL 16 oficial pelo winget. Aguarde...'
    & winget install --exact --id PostgreSQL.PostgreSQL.16 --silent --disable-interactivity --accept-source-agreements --accept-package-agreements --override "--mode unattended --unattendedmodeui none --superpassword $adminPassword --serverport $Port"
    if ($LASTEXITCODE -or !(Test-Path $psql)) { throw 'Instalacao do PostgreSQL falhou. Confira o winget, a elevacao e a porta.' }
} else {
    $secure = Read-Host 'Senha do administrador postgres desta instalacao Windows' -AsSecureString
    $adminPassword = [System.Net.NetworkCredential]::new('', $secure).Password
}
$version = Invoke-Database 'postgres' 'postgres' $adminPassword 'SHOW server_version_num'
if ([int]$version -lt 160000 -or [int]$version -ge 170000) { throw 'A porta informada precisa apontar para o PostgreSQL 16.' }
$roleExists = Invoke-Database 'postgres' 'postgres' $adminPassword "SELECT 1 FROM pg_roles WHERE rolname = 'vitalis'"
$dbExists = Invoke-Database 'postgres' 'postgres' $adminPassword "SELECT 1 FROM pg_database WHERE datname = 'vitalis'"
if ($dbExists) { throw 'O banco vitalis ja existe sem configuracao valida. Preserve os dados e configure o acesso manualmente.' }
$password = New-Password
if ($roleExists) {
    throw 'Ja existe um usuario vitalis sem configuracao valida. Confira a instalacao antes de continuar.'
}
Invoke-Database 'postgres' 'postgres' $adminPassword "CREATE ROLE vitalis LOGIN PASSWORD '$password'" | Out-Null
try {
    Invoke-Database 'postgres' 'postgres' $adminPassword 'CREATE DATABASE vitalis OWNER vitalis' | Out-Null
} catch {
    Invoke-Database 'postgres' 'postgres' $adminPassword 'DROP ROLE vitalis' | Out-Null
    throw
}
New-Item -ItemType Directory -Force $homeDir | Out-Null
$config = @{host='127.0.0.1'; port=$Port; user='vitalis'; password=$password; pgDump=(Join-Path $bin 'pg_dump.exe')}
[IO.File]::WriteAllText($configFile, ($config | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
Write-Host 'Banco local e configuracao do Vitalis prontos.'
