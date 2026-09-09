const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('commandCenter', {
  list: () => ipcRenderer.invoke('sessions:list'),
  create: input => ipcRenderer.invoke('sessions:create', input),
  send: (id, command) => ipcRenderer.invoke('sessions:send', id, command),
  close: id => ipcRenderer.invoke('sessions:close', id),
  onOutput: callback => ipcRenderer.on('terminal:output', (_event, data) => callback(data)),
  onState: callback => ipcRenderer.on('terminal:state', (_event, data) => callback(data))
});
