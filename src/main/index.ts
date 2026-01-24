import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { EndnoteExporter } from './EndnoteExporter'
import { IpcChannels } from '../shared/ipcChannels'
// import icon from '../../resources/icon.png?asset'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    // ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

ipcMain.on(IpcChannels.openFileDialog, (event) => {
  dialog
    .showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'EndNote Library', extensions: ['enl'] }]
    })
    .then((result) => {
      if (!result.canceled && result.filePaths.length > 0) {
        event.sender.send(IpcChannels.fileSelected, result.filePaths[0])
      }
    })
    .catch((err) => {
      console.log(err)
    })
})

ipcMain.on(IpcChannels.startExport, (event, { enlFilePath }) => {
  dialog
    .showSaveDialog({
      defaultPath: enlFilePath.replace('.enl', '_zotero_export.xml'),
      filters: [{ name: 'XML Files', extensions: ['xml'] }]
    })
    .then((result) => {
      if (!result.canceled && result.filePath) {
        try {
          const exporter = new EndnoteExporter()
          const progressCallback = (message: string) => {
            event.sender.send(IpcChannels.exportProgress, message)
          }
          const { count, outputPath } = exporter.exportReferencesToXml(
            enlFilePath,
            result.filePath,
            progressCallback
          )
          event.sender.send(IpcChannels.exportComplete, { count, outputPath })
        } catch (error) {
          const err = error as Error
          event.sender.send(IpcChannels.exportError, err.message)
        }
      }
    })
    .catch((err) => {
      event.sender.send(IpcChannels.exportError, err.message)
    })
})
