import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { initializeIpc, cleanupIpc } from './ipc'
import { initializeSchema, closeDatabase } from './database'
import { logger } from './logger'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
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
  app.setName('OxygenClaw')

  logger.info('Application starting', {
    version: app.getVersion(),
    isPackaged: app.isPackaged,
    platform: process.platform
  })

  // Initialize database
  initializeSchema()
  logger.info('Database initialized')

  // Initialize IPC handlers
  initializeIpc()
  logger.info('IPC handlers registered')

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Cleanup on quit
app.on('will-quit', () => {
  logger.info('Application shutting down')
  cleanupIpc()
  closeDatabase()
  logger.info('Cleanup complete')
})

// 全局异常捕获
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack
  })
})

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', {
    reason: String(reason)
  })
})
