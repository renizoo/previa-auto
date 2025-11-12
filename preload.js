const { contextBridge, ipcRenderer } = require('electron');

// Expõe APIs seguras para o renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Executar automação completa (download + processamento)
  runFullAutomation: () => ipcRenderer.invoke('run-full-automation'),

  // Abrir arquivo de saída
  openOutputFile: (filePath) => ipcRenderer.invoke('open-output-file', filePath),

  // Listeners para output em tempo real
  onAutomationOutput: (callback) => {
    ipcRenderer.on('automation-output', (event, data) => callback(data));
  },

  onAutomationError: (callback) => {
    ipcRenderer.on('automation-error', (event, data) => callback(data));
  },

  // APIs de gerenciamento de motoboys
  readMotoboys: () => ipcRenderer.invoke('read-motoboys'),
  saveMotoboys: (motoboys) => ipcRenderer.invoke('save-motoboys', motoboys),
  addMotoboy: (motoboy) => ipcRenderer.invoke('add-motoboy', motoboy),
  deleteMotoboy: (index) => ipcRenderer.invoke('delete-motoboy', index),

  // API de scanner de código
  searchDeliveryByCode: (code) => ipcRenderer.invoke('search-delivery-by-code', code)
});
