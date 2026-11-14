import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol } from 'electron'
import { spawn, execFile } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { promisify } from 'node:util'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import { startUpdates } from './updates'
import { cleanPrevious, stopPreviousApi } from './api-pid'

const execute = promisify(execFile)
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const developmentUrl = process.env.VITE_DEV_SERVER_URL
const java = path.join(process.resourcesPath, 'runtime', 'jre', 'bin', 'java.exe')
const jar = path.join(process.resourcesPath, 'runtime', 'vitalis-api.jar')
let win: BrowserWindow | undefined
let api: ChildProcess | undefined
let apiClosed: Promise<void> | undefined
let apiUrl = 'http://localhost:8080'
let quitting = false
let stopped = false
let lastApiOutput = ''
let installUpdate: (() => Promise<boolean>) | undefined

protocol.registerSchemesAsPrivileged([
  { scheme: 'vitalis', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])

async function rotate(file: string) {
  const stat = await fs.stat(file).catch(() => undefined)
  if (stat && stat.size > 2 * 1024 * 1024) {
    await fs.rm(file + '.1', { force: true })
    await fs.rename(file, file + '.1')
  }
}

async function freePort(): Promise<number> {
  const server = createServer()
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(error => {
        if (error || !address || typeof address === 'string') reject(error ?? Error('Porta indisponível'))
        else resolve(address.port)
      })
    })
  })
}

interface DatabaseConfig {
  host: string
  port: number
  user: string
  password: string
  pgDump?: string
}

async function readConfig(home: string): Promise<DatabaseConfig> {
  const file = path.join(home, 'config.json')
  await fs.writeFile(file, JSON.stringify({ host: '127.0.0.1', port: 5432, user: 'vitalis', password: '' }, null, 2), { flag: 'wx' })
    .catch(error => { if (error.code !== 'EEXIST') throw error })
  const cfg = JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''))
  if (!cfg || !['localhost', '127.0.0.1'].includes(cfg.host) ||
    !Number.isInteger(cfg.port) || cfg.port < 1 || cfg.port > 65535 ||
    typeof cfg.user !== 'string' || !cfg.user || typeof cfg.password !== 'string' || !cfg.password) {
    throw Error('Configuração do banco incompleta. Execute o script setup-pc.ps1 antes de abrir o Vitalis.')
  }
  return cfg
}

async function backup(home: string, cfg: DatabaseConfig, force = false) {
  const dir = path.join(home, 'backups')
  await fs.mkdir(dir, { recursive: true })
  const list = (await fs.readdir(dir)).filter(name => /^vitalis-\d+\.dump$/.test(name))
    .sort((a, b) => Number(b.slice(8, -5)) - Number(a.slice(8, -5)))
  if (!force && list[0] && Date.now() - Number(list[0].slice(8, -5)) < 86400000) return
  const dump = cfg.pgDump ?? path.join(process.env.ProgramFiles ?? 'C:/Program Files', 'PostgreSQL', '16', 'bin', 'pg_dump.exe')
  const file = path.join(dir, 'vitalis-' + Date.now() + '.dump')
  try {
    await execute(dump, ['-w', '-Fc', '-h', cfg.host, '-p', String(cfg.port), '-U', cfg.user, '-f', file + '.partial', 'vitalis'],
      { env: { ...process.env, PGPASSWORD: cfg.password, PGCONNECT_TIMEOUT: '10' }, windowsHide: true, timeout: 300000 })
    await fs.rename(file + '.partial', file)
  } finally {
    await fs.rm(file + '.partial', { force: true })
  }
  await Promise.all(list.slice(6).map(name => fs.rm(path.join(dir, name), { force: true })))
}

async function startApi(home: string, cfg: DatabaseConfig, log: (message: string) => Promise<void>) {
  const file = path.join(home, 'api.pid')
  await cleanPrevious(file, pid => stopPreviousApi(pid, java, jar), log)
  if (quitting) return
  const port = await freePort()
  if (quitting) return
  apiUrl = 'http://127.0.0.1:' + port
  const apiLog = path.join(home, 'logs', 'api.log')
  await rotate(apiLog)
  if (quitting) return
  api = spawn(java, ['-jar', jar, '--vitalis.desktop=true', '--server.address=127.0.0.1',
    '--server.port=' + port, '--spring.flyway.ignore-migration-patterns=*:pending', '--spring.profiles.active=desktop', '--logging.file.name=' + apiLog,
    '--logging.logback.rollingpolicy.max-file-size=2MB', '--logging.logback.rollingpolicy.max-history=7',
    '--logging.logback.rollingpolicy.total-size-cap=16MB'], {
    cwd: home,
    windowsHide: true,
    env: {
      ...process.env,
      SPRING_DATASOURCE_URL: 'jdbc:postgresql://' + cfg.host + ':' + cfg.port + '/vitalis',
      SPRING_DATASOURCE_USERNAME: cfg.user,
      SPRING_DATASOURCE_PASSWORD: cfg.password,
    },
  })
  const child = api
  const pidWritten = child.pid
    ? fs.writeFile(file, String(child.pid)).catch(() =>
        log('Não foi possível salvar o PID da API.').catch(() => undefined))
    : Promise.resolve()
  const exited = new Promise<void>(resolve => child.once('close', () => resolve()))
  apiClosed = exited.then(async () => {
    await pidWritten
    await fs.rm(file, { force: true }).catch(() =>
      log('Não foi possível remover o PID da API.').catch(() => undefined))
  })
  child.on('error', error => { lastApiOutput += error.message })
  child.stdin?.on('error', () => undefined)
  const capture = (output: Buffer) => { lastApiOutput = (lastApiOutput + output.toString()).slice(-32000) }
  child.stdout?.on('data', capture)
  child.stderr?.on('data', capture)
  await pidWritten
  await log('Iniciando API local na porta ' + port)
  const until = Date.now() + 60000
  while (!quitting && Date.now() < until && child.exitCode === null && child.pid) {
    const response = await fetch(apiUrl + '/health', { signal: AbortSignal.timeout(1000) }).catch(() => undefined)
    if (response?.ok && (await response.json().catch(() => null))?.status === 'UP') return
    await new Promise(resolve => setTimeout(resolve, 300))
  }
  if (quitting) return
  if (/applied migration not resolved locally|newer than the latest available migration/i.test(lastApiOutput)) {
    throw Error('O banco foi atualizado por uma versão mais recente ou incompatível do Vitalis. Instale a versão mais recente antes de continuar.')
  }
  if (/baseline|flyway/i.test(lastApiOutput) && /schema history|non-empty schema/i.test(lastApiOutput)) {
    throw Error('O banco existente ainda precisa ser registrado no Flyway. Peça ao responsável para conferir o schema e fazer o baseline em V1.')
  }
  if (/connection|conexão|password authentication|hikari/i.test(lastApiOutput)) {
    throw Error('Não foi possível conectar ao PostgreSQL. Verifique o serviço do Windows e a configuração do Vitalis.')
  }
  throw Error('A API local não iniciou. Consulte logs/api.log na pasta de dados do Vitalis.')
}

app.setName('Vitalis')
if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => {
    if (win?.isMinimized()) win.restore()
    win?.focus()
  })
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', event => {
    if (stopped) return
    event.preventDefault()
    if (quitting) return
    quitting = true
    void (async () => {
      api?.stdin?.end()
      if (apiClosed) {
        let timeout: ReturnType<typeof setTimeout> | undefined
        await Promise.race([apiClosed, new Promise<void>(resolve => { timeout = setTimeout(resolve, 8000) })])
        clearTimeout(timeout)
        if (api?.exitCode === null) api.kill()
        await apiClosed
      }
      stopped = true
      if (!await installUpdate?.()) app.quit()
    })()
  })
  Menu.setApplicationMenu(null)
  void app.whenReady().then(async () => {
    const home = app.getPath('userData')
    const logs = path.join(home, 'logs')
    const mainLog = path.join(logs, 'main.log')
    const log = async (message: string) => {
      await rotate(mainLog)
      await fs.appendFile(mainLog, new Date().toISOString() + ' ' + message + '\n')
    }
    await fs.mkdir(logs, { recursive: true })
    protocol.handle('vitalis', request => {
      const url = new URL(request.url)
      const dist = path.join(root, 'dist')
      const file = path.resolve(dist, '.' + decodeURIComponent(url.pathname))
      return url.host === 'app' && file.startsWith(dist + path.sep)
        ? net.fetch(pathToFileURL(file).href) : new Response(null, { status: 404 })
    })
    ipcMain.handle('vitalis:api-url', event => {
      if (event.sender !== win?.webContents) throw Error('Janela desconhecida')
      return apiUrl
    })
    win = new BrowserWindow({
      title: 'Vitalis',
      icon: path.join(root, 'dist', 'icon_vitalis.ico'),
      webPreferences: { sandbox: false, preload: path.join(path.dirname(fileURLToPath(import.meta.url)), 'preload.mjs') },
    })
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.webContents.on('will-navigate', event => event.preventDefault())
    if (developmentUrl) {
      await win.loadURL(developmentUrl)
      return
    }
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<title>Vitalis</title><body style="font:20px system-ui;padding:2rem" role="status">Iniciando o Vitalis…</body>'))
    const cfg = await readConfig(home)
    await startApi(home, cfg, log)
    if (quitting) return
    await win.loadURL('vitalis://app/index.html')
    const startupBackup = backup(home, cfg).catch(async () => {
      await log('Falha no backup automático. Verifique o pg_dump e as permissões.')
      if (!quitting && win && !win.isDestroyed()) void dialog.showMessageBox(win, {
        type: 'warning', message: 'Não foi possível fazer o backup automático do Vitalis.',
      }).catch(() => undefined)
    })
    installUpdate = startUpdates(win, async () => {
      await startupBackup
      await backup(home, cfg, true)
    }, log, () => quitting)
  }).catch(error => {
    if (!quitting) dialog.showErrorBox('Vitalis', error instanceof Error ? error.message : 'Falha na inicialização.')
    app.quit()
  })
}
