import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: (): Promise<{ name: string; bytes: Uint8Array } | null> =>
    ipcRenderer.invoke('file:open-dialog')
});