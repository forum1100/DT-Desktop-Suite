const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { Vault } = require('../../../packages/core/src/vault.cjs');
const { AgentRegistry } = require('../../../packages/core/src/registry.cjs');
const { Broker } = require('../../../packages/core/src/broker.cjs');
const { KeyAuthority } = require('../../../packages/core/src/keys.cjs');
const { createGateway } = require('../../../packages/core/src/gateway.cjs');
const { RecoveryAuthority } = require('../../../packages/auth/src/recovery.cjs');
const { ownerBootstrap, isOwner } = require('../../../packages/auth/src/policy.cjs');
const { agents } = require('../../../packages/tools/src/agents.cjs');
const { schemas } = require('../../../packages/tools/src/schemas.cjs');
const { runAgent } = require('../../../packages/tools/src/runner.cjs');

let vault, keys, broker, gateway, recovery;
const ownerProfile = require('../../../config/owner.json');

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
  ipcMain.handle('agents:list', () => registry.list().map(agent => ({ ...agent, schema: schemas[agent.id] })));
  ipcMain.handle('agent:run', (_event, agentId, input) => {
    const output = runAgent(agentId, input);
    const receipt = vault.append('agent-run', agentId, output);
    return { output, receipt };
  });
  ipcMain.handle('vault:list', () => vault.all());
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
  ipcMain.handle('provider:store', (_event, provider, secret) => {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption unavailable');
    const file = credentialFile(provider);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, safeStorage.encryptString(secret));
    vault.append('provider-credential-stored', 'dt-hub', { provider });
    return true;
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
