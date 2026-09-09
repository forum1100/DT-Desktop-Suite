const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dt', {
  listAgents: () => ipcRenderer.invoke('agents:list'),
  runAgent: (agentId, input) => ipcRenderer.invoke('agent:run', agentId, input),
  listVault: () => ipcRenderer.invoke('vault:list'),
  issueKey: request => ipcRenderer.invoke('key:issue', request),
  ownerStatus: () => ipcRenderer.invoke('owner:status'),
  ownerSetup: () => ipcRenderer.invoke('owner:setup'),
  storeProvider: (provider, secret) => ipcRenderer.invoke('provider:store', provider, secret)
});
