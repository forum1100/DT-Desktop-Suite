const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dt', {
  hubStatus: () => ipcRenderer.invoke('hub:status'),
  listAgents: () => ipcRenderer.invoke('agents:list'),
  runAgent: (agentId, input) => ipcRenderer.invoke('agent:run', agentId, input),
  listVault: () => ipcRenderer.invoke('vault:list'),
  issueKey: request => ipcRenderer.invoke('key:issue', request),
  ownerStatus: () => ipcRenderer.invoke('owner:status'),
  ownerSetup: () => ipcRenderer.invoke('owner:setup'),
  ownerRecover: ticket => ipcRenderer.invoke('owner:recover', ticket),
  listProviders: () => ipcRenderer.invoke('provider:list'),
  storeProvider: (provider, secret) => ipcRenderer.invoke('provider:store', provider, secret),
  askProvider: request => ipcRenderer.invoke('provider:ask', request)
});
