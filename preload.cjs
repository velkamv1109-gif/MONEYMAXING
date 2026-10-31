const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('moneymaxing', Object.freeze({
  exportQuotation: quote => ipcRenderer.invoke('quotation:export-pdf', quote)
}));
