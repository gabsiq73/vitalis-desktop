import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('vitalis', {
  getApiUrl: () => ipcRenderer.invoke('vitalis:api-url') as Promise<string>,
  getLogsPath: () => ipcRenderer.invoke('vitalis:logs-path') as Promise<string>,
  retryStartup: () => ipcRenderer.invoke('vitalis:retry-startup') as Promise<void>,
})
