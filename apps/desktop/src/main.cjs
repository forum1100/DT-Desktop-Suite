const { app, BrowserWindow, ipcMain, safeStorage, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { Vault } = require('../../../packages/core/src/vault.cjs');
const { AgentRegistry } = require('../../../packages/core/src/registry.cjs');
const { Broker } = require('../../../packages/core/src/broker.cjs');
const { KeyAuthority } = require('../../../packages/core/src/keys.cjs');
const { createGateway } = require('../../../packages/core/src/gateway.cjs');
const { createBundle, verifyBundle } = require('../../../packages/core/src/portable.cjs');
const { RecoveryAuthority } = require('../../../packages/auth/src/recovery.cjs');
const { ownerBootstrap, isOwner } = require('../../../packages/auth/src/policy.cjs');
const { agents } = require('../../../packages/tools/src/agents.cjs');
const { schemas } = require('../../../packages/tools/src/schemas.cjs');
const { briefs } = require('../../../packages/tools/src/briefs.cjs');
const { runAgent } = require('../../../packages/tools/src/runner.cjs');
const { routeTask, executeWorkflow } = require('../../../packages/tools/src/workflow.cjs');
const { inboxFor, processInbox } = require('../../../packages/tools/src/inbox.cjs');
const { preflight } = require('../../../packages/safety/src/preflight.cjs');
const { PROVIDERS, providerDefinition, requestAI } = require('../../../packages/providers/src/index.cjs');
const { listSimulations, replaySimulation } = require('../../../packages/simulations/src/replay.cjs');

let vault, keys, broker, gateway, recovery;
const suiteStartedAt = Date.now();
const activeRuns = new Map();
const ownerProfile = require('../../../packages/auth/src/owner.cjs');

function operationsSnapshot() {
  const rows=vault.all().filter(row=>row.kind==='agent-run'),byAgent={};
  for(const row of rows){const id=row.agentId||'unknown',m=row.data?.runtimeMetric||{};
    const x=byAgent[id]||={agentId:id,runs:0,failures:0,durationMs:0,inputBytes:0,outputBytes:0,lastRun:null};
    x.runs++;x.failures+=m.success===false?1:0;x.durationMs+=Number(m.durationMs||0);
    x.inputBytes+=Number(m.inputBytes||0);x.outputBytes+=Number(m.outputBytes||0);x.lastRun=row.createdAt}
  const active=[...activeRuns.values()].map(run=>({...run,elapsedMs:Date.now()-run.startedMs}));
  let agentMetrics=Object.values(byAgent).map(x=>({...x,
    successRate:x.runs?(x.runs-x.failures)/x.runs:0,averageMs:x.runs?x.durationMs/x.runs:0,
    active:active.some(run=>run.agentId===x.agentId)}));
  let coordinator=null;
  try {
    const file=path.join(process.env.USERPROFILE||'','Documents','TJ_Local_Coordinator','state','operations_snapshot.json');
    coordinator=JSON.parse(fs.readFileSync(file,'utf8'));
    for(const worker of coordinator.workers||[]){if(!worker.alive)continue;
      active.push({runId:'coordinator:'+worker.worker_id,agentId:worker.worker_id,
        startedMs:null,elapsedMs:Number(worker.uptime_seconds||0)*1000,status:worker.status});
      agentMetrics.push({agentId:worker.worker_id,runs:Number(worker.task_count||0),failures:0,
        durationMs:Number(worker.uptime_seconds||0)*1000,inputBytes:0,outputBytes:0,
        lastRun:worker.last_heartbeat,successRate:1,averageMs:0,active:true,source:'coordinator'})}
  } catch {}
  const totals=agentMetrics.reduce((a,x)=>({runs:a.runs+x.runs,failures:a.failures+x.failures,
    durationMs:a.durationMs+x.durationMs,inputBytes:a.inputBytes+x.inputBytes,
    outputBytes:a.outputBytes+x.outputBytes}),{runs:0,failures:0,durationMs:0,inputBytes:0,outputBytes:0});
  return {suiteUptimeMs:Date.now()-suiteStartedAt,active,agents:agentMetrics,totals,coordinator,
    scientificStatus:'OBSERVED_LOCAL_RUNTIME_METRICS_NOT_MODEL_TOKEN_BILLING'};
}


function dataRoot() {
  return path.join(app.getPath('userData'), 'dt-vault');
}

function createWindow(agentId = null) {
  const win = new BrowserWindow({
    width: 1320, height: 860, minWidth: 920, minHeight: 620,
    backgroundColor: '#070914',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.loadFile(path.join(__dirname, 'index.html'), { query: agentId ? { agent: agentId } : {} });
}

function credentialFile(provider) {
  return path.join(dataRoot(), 'credentials', provider + '.bin');
}

function readCredential(provider) {
  const file = credentialFile(provider);
  if (!fs.existsSync(file)) return null;
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption unavailable');
  return safeStorage.decryptString(fs.readFileSync(file));
}

function authenticatedGithubLogin() {
  const wingetRoot = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  let wingetGh = null;
  try {
    const folder = fs.readdirSync(wingetRoot).find(name => name.startsWith('GitHub.cli_'));
    if (folder) wingetGh = path.join(wingetRoot, folder, 'bin', 'gh.exe');
  } catch {}
  const candidates = [
    'gh',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'gh.exe'),
    wingetGh
  ].filter(Boolean);
  for (const executable of candidates) {
    try {
      return execFileSync(executable, ['api', 'user', '--jq', '.login'], {
        encoding: 'utf8', windowsHide: true
      }).trim();
    } catch {}
  }
  return null;
}

function registerIPC(registry) {
  ipcMain.handle('hub:status', () => ({ ...gateway.status(), port: gateway.port }));
  ipcMain.handle('agents:list', () => registry.list().map(agent => ({
    ...agent,
    schema: schemas[agent.id],
    brief: briefs[agent.id]
  })));
  ipcMain.handle('operations:snapshot', () => operationsSnapshot());
  ipcMain.handle('simulations:list', () => listSimulations());
  ipcMain.handle('simulations:replay', (_event, request = {}) => {
    let pythonPath = String(request.pythonPath || '').trim();
    if (!pythonPath) {
      try {
        pythonPath = execFileSync('py', ['-3', '-c', 'import sys;print(sys.executable)'], {
          encoding: 'utf8', windowsHide: true
        }).trim();
      } catch {
        throw new Error('Python 3 was not detected. Enter the full Python executable path.');
      }
    }
    const receipt = replaySimulation({
      simulationId: request.simulationId,
      pythonPath,
      outputRoot: String(request.outputRoot || '').trim() || path.join(dataRoot(), 'simulation-runs'),
      extraArgs: Array.isArray(request.extraArgs) ? request.extraArgs : []
    });
    const vaultReceipt = vault.append('simulation-replay', 'simulation-replay', {
      ...receipt,
      historicalSourceClaimed: false,
      scientificStatus: 'EXECUTED_REPLAY_NOT_PHYSICAL_VALIDATION'
    });
    return { receipt, vaultReceipt };
  });
  ipcMain.handle('agent:run', (_event, agentId, input) => {
    const runId = require('node:crypto').randomUUID();
    const startedMs = Date.now();
    activeRuns.set(runId, { runId, agentId, startedMs });
    try {
      const output = runAgent(agentId, input);
      const metric = { durationMs:Date.now()-startedMs, success:true,
        inputBytes:Buffer.byteLength(JSON.stringify(input || {})),
        outputBytes:Buffer.byteLength(JSON.stringify(output || {})) };
      const receipt = vault.append('agent-run', agentId, { ...output, runtimeMetric:metric });
      return { output, receipt, runtimeMetric:metric };
    } catch (error) {
      vault.append('agent-run', agentId, { error:error.message, runtimeMetric:{
        durationMs:Date.now()-startedMs, success:false,
        inputBytes:Buffer.byteLength(JSON.stringify(input || {})), outputBytes:0 }});
      throw error;
    } finally { activeRuns.delete(runId); }
  });
  ipcMain.handle('workflow:route', (_event, request) => routeTask(request, broker, vault));
  ipcMain.handle('workflow:execute', (_event, request) => executeWorkflow(request, broker, vault));
  ipcMain.handle('agent:inbox', (_event, agentId) => inboxFor(agentId, vault));
  ipcMain.handle('agent:process-inbox', (_event, agentId) => processInbox(agentId, vault, broker));
  ipcMain.handle('vault:list', () => vault.all());
  ipcMain.handle('vault:export', async () => {
    const bundle = createBundle(vault.all(), { application: 'DT Desktop Suite' });
    const chosen = await dialog.showSaveDialog({
      title: 'Export consumer-owned DT vault',
      defaultPath: 'DT-Consumer-Vault-' + new Date().toISOString().slice(0, 10) + '.json',
      filters: [{ name: 'DT Vault JSON', extensions: ['json'] }]
    });
    if (chosen.canceled || !chosen.filePath) return { canceled: true };
    fs.writeFileSync(chosen.filePath, JSON.stringify(bundle, null, 2), 'utf8');
    vault.append('vault-exported', 'memory', {
      fileName: path.basename(chosen.filePath),
      recordCount: bundle.recordCount,
      bundleHash: bundle.bundleHash
    });
    return { canceled: false, filePath: chosen.filePath, recordCount: bundle.recordCount, bundleHash: bundle.bundleHash };
  });
  ipcMain.handle('vault:import', async () => {
    const chosen = await dialog.showOpenDialog({
      title: 'Import a DT consumer vault',
      properties: ['openFile'],
      filters: [{ name: 'DT Vault JSON', extensions: ['json'] }]
    });
    if (chosen.canceled || !chosen.filePaths[0]) return { canceled: true };
    const bundle = JSON.parse(fs.readFileSync(chosen.filePaths[0], 'utf8'));
    const verified = verifyBundle(bundle);
    if (!verified.valid) throw new Error('Vault rejected: ' + verified.reason);
    const archiveRoot = path.join(dataRoot(), 'imports');
    fs.mkdirSync(archiveRoot, { recursive: true });
    const archiveFile = path.join(archiveRoot, verified.bundleHash + '.json');
    const duplicateArchive = fs.existsSync(archiveFile);
    if (!duplicateArchive) fs.writeFileSync(archiveFile, JSON.stringify(bundle, null, 2), 'utf8');
    const receipt = vault.append('vault-imported', 'memory', {
      sourceFileName: path.basename(chosen.filePaths[0]),
      archiveFileName: path.basename(archiveFile),
      recordCount: verified.recordCount,
      originalHeadHash: verified.headHash,
      bundleHash: verified.bundleHash,
      duplicateArchive
    });
    return { canceled: false, verified, receipt };
  });
  ipcMain.handle('key:issue', (_event, request) => {
    const issued = keys.issue(request);
    vault.append('key-issued', 'dt-hub', { id: issued.id, scopes: issued.scopes });
    return issued;
  });
  ipcMain.handle('owner:status', () => {
    const login = authenticatedGithubLogin();
    return { owner: ownerProfile.githubLogin, authenticatedLogin: login, verified: isOwner(ownerProfile, login) };
  });
  ipcMain.handle('owner:setup', () => {
    const login = authenticatedGithubLogin();
    if (!isOwner(ownerProfile, login)) throw new Error('Authenticate GitHub CLI as forum1100 first');
    const priorOwner = keys.load().find(row => row.label === `owner:${ownerProfile.githubLogin}` && !row.revokedAt);
    const priorRecovery = recovery.load();
    const adminKey = priorOwner ? null : ownerBootstrap(keys, ownerProfile);
    const recoveryTickets = priorRecovery.length ? [] : recovery.issuePair();
    vault.append('owner-setup', 'dt-hub', {
      githubLogin: login,
      adminKeyId: adminKey?.id || priorOwner?.id,
      recoveryTicketIds: recoveryTickets.map(item => item.id)
    });
    return { verified: true, adminKey, recoveryTickets, shownOnce: true };
  });
  ipcMain.handle('owner:recover', (_event, ticket) => {
    const login = authenticatedGithubLogin();
    const restored = recovery.redeem(ticket, login);
    vault.append('owner-recovered', 'dt-hub', { githubLogin: login, adminKeyId: restored.id });
    return { verified: true, adminKey: restored, shownOnce: true };
  });
  ipcMain.handle('provider:list', () => Object.entries(PROVIDERS).map(([id, item]) => ({
    id,
    label: item.label,
    keyRequired: item.keyRequired,
    hasCredential: fs.existsSync(credentialFile(id)),
    connected: !item.keyRequired || fs.existsSync(credentialFile(id))
  })));
  ipcMain.handle('provider:store', (_event, provider, secret) => {
    if (!PROVIDERS[provider]) throw new Error('Unsupported provider');
    if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption unavailable');
    if (!String(secret || '').trim()) throw new Error('Credential cannot be empty');
    const file = credentialFile(provider);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, safeStorage.encryptString(secret.trim()));
    vault.append('provider-credential-stored', 'dt-hub', { provider });
    return true;
  });
  ipcMain.handle('provider:ask', async (_event, request) => {
    const { provider, model, baseUrl, prompt, agentId, input } = request;
    if (!String(prompt || '').trim()) throw new Error('Question required');
    const definition = providerDefinition(provider, baseUrl ? { baseUrl } : {});
    const agent = registry.get(agentId);
    const brief = briefs[agentId];
    const system = [
      'You are connected to the local DT Desktop Suite.',
      'Preserve sources, contradictions, failed branches, uncertainty, and consumer authority.',
      'Do not certify truth or promote experimental work as established science.',
      agent ? 'Active program: ' + agent.name + ' (' + agent.status + ').' : 'No active program selected.',
      brief ? 'Program thesis: ' + brief.thesis + ' Governing relation: ' + brief.equation : '',
      'Current consumer inputs: ' + JSON.stringify(input || {})
    ].filter(Boolean).join('\n');
    const response = await requestAI(definition, {
      apiKey: readCredential(provider),
      model,
      system,
      messages: [{ role: 'user', content: prompt.trim() }]
    });
    const safety = preflight({ text: response.text, sources: [], status: 'provider-generated', authority: provider });
    const receipt = vault.append('provider-response', agentId || 'dt-hub', {
      provider, model, prompt: prompt.trim(), response: response.text, safety
    });
    return { text: response.text, safety, receipt };
  });
}

app.whenReady().then(() => {
  const root = dataRoot();
  vault = new Vault(root);
  keys = new KeyAuthority(path.join(root, 'authority'));
  recovery = new RecoveryAuthority(path.join(root, 'authority'), keys, ownerProfile.githubLogin);
  const registry = new AgentRegistry(agents);
  broker = new Broker(vault, registry);
  gateway = createGateway({ keys, vault, broker, agents: registry });
  gateway.start();
  registerIPC(registry);
  const flag = process.argv.find(arg => arg.startsWith('--agent='));
  createWindow(flag ? flag.slice(8) : null);
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on('window-all-closed', () => {
  gateway?.stop();
  if (process.platform !== 'darwin') app.quit();
});
