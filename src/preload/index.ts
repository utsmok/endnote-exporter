import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '../shared/ipcChannels'

const api = {
  openFileDialog: () => ipcRenderer.send(IpcChannels.openFileDialog),
  onFileSelected: (callback: (filePath: string) => void) => {
    ipcRenderer.on(IpcChannels.fileSelected, (_event, filePath) => callback(filePath))
  },
  startExport: (enlFilePath: string) => {
    ipcRenderer.send(IpcChannels.startExport, { enlFilePath })
  },
  onExportProgress: (callback: (message: string) => void) => {
    ipcRenderer.on(IpcChannels.exportProgress, (_event, message) => callback(message))
  },
  onExportComplete: (callback: (result: { count: number; outputPath: string }) => void) => {
    ipcRenderer.on(IpcChannels.exportComplete, (_event, result) => callback(result))
  },
  onExportError: (callback: (errorMessage: string) => void) => {
    ipcRenderer.on(IpcChannels.exportError, (_event, errorMessage) => callback(errorMessage))
  },
  removeListeners: () => {
    ipcRenderer.removeAllListeners(IpcChannels.fileSelected)
    ipcRenderer.removeAllListeners(IpcChannels.exportProgress)
    ipcRenderer.removeAllListeners(IpcChannels.exportComplete)
    ipcRenderer.removeAllListeners(IpcChannels.exportError)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
