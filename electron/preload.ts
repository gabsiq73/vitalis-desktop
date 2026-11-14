import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('vitalis', {
  getApiUrl: () => ipcRenderer.invoke('vitalis:api-url') as Promise<string>,
})
