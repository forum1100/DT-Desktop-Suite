const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dt', {
  hubStatus: () => ipcRenderer.invoke('hub:status'),
  listAgents: () => ipcRenderer.invoke('agents:list'),
  operationsSnapshot: () => ipcRenderer.invoke('operations:snapshot'),
  runAgent: (agentId, input) => ipcRenderer.invoke('agent:run', agentId, input),
  routeWorkflow: request => ipcRenderer.invoke('workflow:route', request),
  executeWorkflow: request => ipcRenderer.invoke('workflow:execute', request),
  getInbox: agentId => ipcRenderer.invoke('agent:inbox', agentId),
  processInbox: agentId => ipcRenderer.invoke('agent:process-inbox', agentId),
  listVault: () => ipcRenderer.invoke('vault:list'),
  exportVault: () => ipcRenderer.invoke('vault:export'),
  importVault: () => ipcRenderer.invoke('vault:import'),
  issueKey: request => ipcRenderer.invoke('key:issue', request),
  ownerStatus: () => ipcRenderer.invoke('owner:status'),
  ownerSetup: () => ipcRenderer.invoke('owner:setup'),
  ownerRecover: ticket => ipcRenderer.invoke('owner:recover', ticket),
  listProviders: () => ipcRenderer.invoke('provider:list'),
  storeProvider: (provider, secret) => ipcRenderer.invoke('provider:store', provider, secret),
  askProvider: request => ipcRenderer.invoke('provider:ask', request)
});
