import updater from 'electron-updater'
import { app, BrowserWindow, dialog } from 'electron'

const { autoUpdater } = updater

export function startUpdates(
  window: BrowserWindow,
  backup: () => Promise<void>,
  log: (message: string) => Promise<void>,
  closing: () => boolean,
) {
  if (!app.isPackaged || process.platform !== 'win32') return undefined
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowDowngrade = false
  autoUpdater.logger = null
  let ready = false
  let checking = false
  const report = (message: string) => { void log(message).catch(() => undefined) }

  autoUpdater.on('error', () => report('Falha ao consultar ou baixar atualização.'))
  autoUpdater.on('update-downloaded', () => {
    ready = true
    if (closing() || window.isDestroyed()) return
    void dialog.showMessageBox(window, {
      type: 'info',
      message: 'Atualização pronta, reiniciar para instalar',
      buttons: ['Reiniciar agora', 'Instalar ao fechar'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0 && !closing()) app.quit()
    }).catch(() => undefined)
  })

  async function check() {
    if (checking || ready || closing()) return
    checking = true
    try {
      const result = await autoUpdater.checkForUpdates()
      if (!result?.isUpdateAvailable || closing()) return
      try {
        await backup()
      } catch {
        report('Atualização adiada: não foi possível criar o backup antes do download.')
        return
      }
      if (!closing()) await autoUpdater.downloadUpdate()
    } catch {
      report('Atualização adiada: GitHub Releases indisponível ou download interrompido.')
    } finally {
      checking = false
    }
  }

  const timer = setInterval(() => void check(), 4 * 60 * 60 * 1000)
  timer.unref()
  void check()
  return async () => {
    clearInterval(timer)
    if (!ready) return false
    try {
      await backup()
    } catch {
      await log('Atualização adiada: o backup final falhou.').catch(() => undefined)
      dialog.showErrorBox('Vitalis', 'A atualização foi adiada porque o backup final não pôde ser criado.')
      return false
    }
    autoUpdater.quitAndInstall(true, true)
    // Also close if the updater could not launch NSIS.
    setImmediate(() => app.quit())
    return true
  }
}
