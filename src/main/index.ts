import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { readFile, stat } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

process.on('uncaughtException', (err) => {
  console.error('Main process uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Main process unhandled rejection:', reason);
});

app.disableHardwareAcceleration();

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.on('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) void mainWindow.loadURL(devUrl);
  else void mainWindow.loadFile(join(__dirname, '../dist/index.html'));
}

ipcMain.handle('file:open-dialog', async () => {
  if (!mainWindow) return null;
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Spreadsheets', extensions: ['csv', 'tsv', 'xlsx', 'xls'] }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const path = result.filePaths[0];

    const fileStat = await stat(path);
    if (fileStat.size > MAX_FILE_SIZE) {
      dialog.showErrorBox(
        'File Too Large',
        `The selected file is ${(fileStat.size / (1024 * 1024)).toFixed(1)} MB. Files larger than 100 MB cannot be opened to prevent memory exhaustion.`
      );
      return null;
    }

    const buf = await readFile(path);
    return { name: basename(path), bytes: new Uint8Array(buf) };
  } catch (err) {
    console.error('Error opening file via dialog:', err);
    dialog.showErrorBox(
      'Error Reading File',
      `Could not read the selected file: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
});

app.whenReady().then(() => {
  console.log('Spreadsheet Grapher main process ready!');
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});