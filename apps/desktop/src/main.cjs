const { app, BrowserWindow, ipcMain, safeStorage, dialog, screen, session, desktopCapturer } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const { Vault } = require('../../../packages/core/src/vault.cjs');
const { AgentRegistry } = require('../../../packages/core/src/registry.cjs');
const { Broker } = require('../../../packages/core/src/broker.cjs');
const { KeyAuthority } = require('../../../packages/core/src/keys.cjs');
const { createGateway } = require('../../../packages/core/src/gateway.cjs');
const { createBundle, verifyBundle } = require('../../../packages/core/src/portable.cjs');
const { appendSeal, createSeal } = require('../../../packages/core/src/provenance.cjs');
const { createReceipt } = require('../../../packages/core/src/peer-mailbox.cjs');
const { prepareGrokHandshake, proposalWasConsumed } = require('../../../packages/core/src/grok-handshake.cjs');
const { prepareGrokCommand, prismCommandDecision, commandProposalWasConsumed, createCommandReceipt } = require('../../../packages/core/src/grok-command.cjs');
const { createPeerMessage, verifyPeerMessage } = require('../../../packages/core/src/peer-chat.cjs');
const { listPeerExecutives } = require('../../../packages/auth/src/peers.cjs');
const { RecoveryAuthority } = require('../../../packages/auth/src/recovery.cjs');
const { ownerBootstrap, isOwner } = require('../../../packages/auth/src/policy.cjs');
const { agents } = require('../../../packages/tools/src/agents.cjs');
const { schemas } = require('../../../packages/tools/src/schemas.cjs');
const { briefs } = require('../../../packages/tools/src/briefs.cjs');
const { runAgent } = require('../../../packages/tools/src/runner.cjs');
const { EmbeddedSupervisor } = require('../../../packages/tools/src/supervisor.cjs');
const { routeTask, executeWorkflow } = require('../../../packages/tools/src/workflow.cjs');
const { inboxFor, processInbox } = require('../../../packages/tools/src/inbox.cjs');
const { preflight } = require('../../../packages/safety/src/preflight.cjs');
const { PROVIDERS, providerDefinition, requestAI } = require('../../../packages/providers/src/index.cjs');
const { listSimulations, replaySimulation } = require('../../../packages/simulations/src/replay.cjs');

let vault, keys, broker, gateway, recovery, supervisor;
const suiteStartedAt = Date.now();
const activeRuns = new Map();
const activeCaptureSessions = new Set();
const pendingControlActions = new Map();
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

function peerConnectionRoot() {
  return path.join(dataRoot(), 'peer-connections');
}

function connectedPeers() {
  const root = peerConnectionRoot();
  fs.mkdirSync(root, { recursive: true });
  const known = new Map(listPeerExecutives().map(peer => [peer.id, peer]));
  const rows = [];
  for (const file of fs.readdirSync(root).filter(name => name.endsWith('.json'))) {
    try {
      const state = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
      if (state.status !== 'CONNECTED' || !known.has(state.executiveId)) continue;
      rows.push({ ...known.get(state.executiveId), ...state });
    } catch {}
  }
  return rows;
}

function persistPeerConnection(executiveId, state = {}) {
  const peer = listPeerExecutives().find(item => item.id === executiveId);
  if (!peer) throw new Error('Unknown peer executive');
  const root = peerConnectionRoot(); fs.mkdirSync(root, { recursive: true });
  const record = { ...peer, ...state, executiveId: peer.id, gatewayAuthority: 'DT_PLATFORM', updatedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(root, `${peer.id}.json`), JSON.stringify(record, null, 2));
  return record;
}

function commandAllowedRoots() {
  const roots = [process.env.USERPROFILE || ''].filter(Boolean);
  const drive = 'G:\My Drive'; if (fs.existsSync(drive)) roots.push(drive);
  return roots;
}

const AI_MAILBOX_PEERS = Object.freeze(['openai', 'anthropic', 'xai', 'ollama', 'compatible']);
function driveStreamingRoot() {
  const configured = process.env.DT_DRIVE_STREAMING_ROOT;
  const fallback = path.join(process.env.USERPROFILE || '', 'Desktop', 'DT-Suit Memory', 'DT_Works_Vault', 'Drive Streaming');
  const root = path.resolve(configured || fallback);
  fs.mkdirSync(root, { recursive: true });
  return root;
}
function aiMailboxRoot(peerId) {
  const id = String(peerId || '').trim().toLowerCase();
  if (!AI_MAILBOX_PEERS.includes(id)) throw new Error('Unknown AI mailbox peer');
  const root = path.join(driveStreamingRoot(), 'ai-mailboxes', id);
  fs.mkdirSync(path.join(root, 'inbound'), { recursive: true });
  fs.mkdirSync(path.join(root, 'outbound'), { recursive: true });
  return root;
}
function mailboxFileName(prefix = 'message') {
  return new Date().toISOString().replace(/[:.]/g, '-') + '-' + prefix + '-' + crypto.randomUUID() + '.json';
}
function writeAiMailbox(peerId, direction, payload = {}) {
  if (!['inbound', 'outbound'].includes(direction)) throw new Error('Mailbox direction must be inbound or outbound');
  const root = aiMailboxRoot(peerId);
  const body = { schema: 'dt-local-ai-mailbox/1.0', peerId, direction, createdAt: new Date().toISOString(), payload };
  body.sha256 = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
  const target = path.join(root, direction, mailboxFileName('dt'));
  const temp = target + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(body, null, 2), 'utf8');
  fs.renameSync(temp, target);
  vault.append('ai-mailbox-write', 'dt-training-bot', { peerId, direction, path: target, sha256: body.sha256 });
  return { ok: true, peerId, direction, path: target, sha256: body.sha256 };
}
function readAiMailbox(peerId, direction = 'inbound') {
  if (!['inbound', 'outbound'].includes(direction)) throw new Error('Mailbox direction must be inbound or outbound');
  const root = aiMailboxRoot(peerId);
  const folder = path.join(root, direction);
  const messages = fs.readdirSync(folder).filter(name => name.endsWith('.json')).sort().map(name => {
    const file = path.join(folder, name);
    try { return { file: name, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch { return { file: name, invalid: true }; }
  });
  return { root, peerId, direction, messages };
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

function provenanceKeys() {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption unavailable for provenance key');
  const root = path.join(dataRoot(), 'credentials');
  const privateFile = path.join(root, 'dt-provenance-private.bin');
  const publicFile = path.join(root, 'dt-provenance-public.pem');
  fs.mkdirSync(root, { recursive: true });
  if (!fs.existsSync(privateFile) || !fs.existsSync(publicFile)) {
    const pair = crypto.generateKeyPairSync('ed25519');
    const privateKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
    const publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' });
    fs.writeFileSync(privateFile, safeStorage.encryptString(privateKey));
    fs.writeFileSync(publicFile, publicKey, 'utf8');
    vault.append('provenance-key-created', 'dt-provenance-sealer', {
      algorithm: 'Ed25519', publicKeySha256: crypto.createHash('sha256').update(publicKey).digest('hex') });
  }
  return { privateKey: safeStorage.decryptString(fs.readFileSync(privateFile)),
    publicKey: fs.readFileSync(publicFile, 'utf8') };
}

function githubCliExecutable() {
  const wingetRoot = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  let wingetGh = null;
  try {
    const folder = fs.readdirSync(wingetRoot).find(name => name.startsWith('GitHub.cli_'));
    if (folder) wingetGh = path.join(wingetRoot, folder, 'bin', 'gh.exe');
  } catch {}
  const candidates = ['gh', path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'gh.exe'), wingetGh].filter(Boolean);
  for (const executable of candidates) {
    try {
      execFileSync(executable, ['--version'], { encoding: 'utf8', windowsHide: true });
      return executable;
    } catch {}
  }
  return null;
}

function authenticatedGithubLogin() {
  const executable = githubCliExecutable();
  if (!executable) return null;
  try {
    return execFileSync(executable, ['api', 'user', '--jq', '.login'], { encoding: 'utf8', windowsHide: true }).trim();
  } catch { return null; }
}

const DT_GITHUB_REPO = 'forum1100/DT-Desktop-Suite';
const GROK_INBOUND_PATH = 'runtime/peer-mailbox/inbound/grok-ceo';
const GROK_OUTBOUND_PATH = 'runtime/peer-mailbox/outbound/grok-ceo';
const PEER_CHAT_INBOUND_PATH = 'runtime/peer-chat/inbound';
const PEER_CHAT_OUTBOUND_PATH = 'runtime/peer-chat/outbound';

function ghApi(executable, args, options = {}) {
  return execFileSync(executable, ['api', ...args], {
    encoding: 'utf8', windowsHide: true, timeout: options.timeout || 15000,
    maxBuffer: 1024 * 1024 * 4
  });
}

function readGithubMailboxFile(executable, repoPath) {
  return ghApi(executable, [
    `repos/${DT_GITHUB_REPO}/contents/${repoPath}?ref=main`,
    '-H', 'Accept: application/vnd.github.raw+json'
  ]);
}

function findGrokProposalsForCapture(captureSessionId, capability = null) {
  const executable = githubCliExecutable();
  if (!executable) throw new Error('GitHub CLI is required for temporary Grok mailbox transport');
  const listing = JSON.parse(ghApi(executable, [`repos/${DT_GITHUB_REPO}/contents/${GROK_INBOUND_PATH}?ref=main`]));
  const matches = [];
  const candidates = listing.filter(item => item.type === 'file' && item.name.endsWith('.json') && !item.name.startsWith('NEGATIVE_'));
  for (const item of candidates) {
    const proposal = JSON.parse(readGithubMailboxFile(executable, `${GROK_INBOUND_PATH}/${item.name}`));
    if (proposal.captureSessionId !== captureSessionId) continue;
    if (capability && proposal.capability !== capability) continue;
    matches.push({ proposal, fileName: item.name });
  }
  return matches.sort((a, b) => String(a.proposal.proposedAt || '').localeCompare(String(b.proposal.proposedAt || '')));
}

function findGrokProposalForCapture(captureSessionId, capability = null) {
  return findGrokProposalsForCapture(captureSessionId, capability)[0] || null;
}

function publishGrokReceipt(receipt, purpose = 'peer') {
  const executable = githubCliExecutable();
  if (!executable) throw new Error('GitHub CLI is required to return the Grok receipt');
  const name = `${receipt.proposalHash}.receipt.json`;
  const body = Buffer.from(JSON.stringify(receipt, null, 2), 'utf8').toString('base64');
  const output = ghApi(executable, [
    '--method', 'PUT', `repos/${DT_GITHUB_REPO}/contents/${GROK_OUTBOUND_PATH}/${name}`,
    '-f', `message=Return DT Grok ${purpose} receipt ${receipt.proposalHash.slice(0, 12)}`,
    '-f', `content=${body}`, '-f', 'branch=main'
  ]);
  const parsed = JSON.parse(output);
  return { commitSha: parsed.commit?.sha || null, path: parsed.content?.path || `${GROK_OUTBOUND_PATH}/${name}` };
}

function runGrokHandshakeCommand(command) {
  const bridgeRoot = path.join(process.env.USERPROFILE || '', 'Documents', 'TJ_Command_Bridge');
  const submit = path.join(bridgeRoot, 'submit.py');
  if (!fs.existsSync(submit)) throw new Error('TJ Command Bridge submit.py was not found');
  const proc = spawnSync('py', ['-3', submit, '--session', 'grok-ceo', '--cwd', bridgeRoot, '--timeout', '30', '--', command], {
    encoding: 'utf8', windowsHide: true, timeout: 45000, maxBuffer: 1024 * 1024
  });
  const raw = String(proc.stdout || '').trim();
  const lines = raw.split(/\r?\n/);
  const bridgeRequestId = lines.shift()?.trim() || null;
  let result = null;
  try { result = JSON.parse(lines.join('\n')); } catch {}
  if (!result) {
    result = { request_id: bridgeRequestId, session_id: 'grok-ceo', exit_code: null,
      stdout: '', stderr: String(proc.stderr || ''), error: proc.error?.message || `submit.py exited ${proc.status}` };
  }
  return { bridgeRequestId, result, submitExitCode: proc.status };
}

function runGrokCommand(command, cwd, timeoutSeconds = 120) {
  const bridgeRoot = path.join(process.env.USERPROFILE || '', 'Documents', 'TJ_Command_Bridge');
  const submit = path.join(bridgeRoot, 'submit.py');
  if (!fs.existsSync(submit)) throw new Error('TJ Command Bridge submit.py was not found');
  if (!fs.existsSync(cwd)) throw new Error('Requested command working directory does not exist');
  const timeout = Math.max(1, Math.min(900, Number(timeoutSeconds) || 120));
  const proc = spawnSync('py', ['-3', submit, '--session', 'grok-ceo', '--cwd', cwd, '--timeout', String(timeout), '--', command], {
    encoding: 'utf8', windowsHide: true, timeout: (timeout + 15) * 1000, maxBuffer: 1024 * 1024 * 4
  });
  const raw = String(proc.stdout || '').trim();
  const lines = raw.split(/\r?\n/);
  const bridgeRequestId = lines.shift()?.trim() || null;
  let result = null;
  try { result = JSON.parse(lines.join('\n')); } catch {}
  if (!result) result = { request_id: bridgeRequestId, session_id: 'grok-ceo', exit_code: null,
    stdout: '', stderr: String(proc.stderr || ''), error: proc.error?.message || `submit.py exited ${proc.status}` };
  return { bridgeRequestId, result, submitExitCode: proc.status };
}

function peerChatCliPath() {
  return path.join(process.env.USERPROFILE || '', 'Documents', 'TJ_Command_Bridge', 'peer_chat.py');
}

function appendLocalPeerMessage(message) {
  const cli = peerChatCliPath();
  if (!fs.existsSync(cli)) throw new Error('DT peer chat CLI was not found');
  const proc = spawnSync('py', ['-3', cli, 'append', '--json', JSON.stringify(message)], {
    encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024
  });
  if (proc.status !== 0) throw new Error(String(proc.stderr || 'Peer chat CLI append failed'));
  return JSON.parse(String(proc.stdout || '{}'));
}

function listLocalPeerMessages(limit = 200) {
  const cli = peerChatCliPath();
  if (!fs.existsSync(cli)) return [];
  const proc = spawnSync('py', ['-3', cli, 'list', '--limit', String(Math.max(1, Math.min(1000, limit)))], {
    encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 * 4
  });
  if (proc.status !== 0) return [];
  try { return JSON.parse(String(proc.stdout || '[]')).filter(verifyPeerMessage); } catch { return []; }
}

function publishPeerChatMessage(message) {
  const executable = githubCliExecutable();
  if (!executable) throw new Error('GitHub CLI is required for temporary peer-chat transport');
  const repoPath = `${PEER_CHAT_OUTBOUND_PATH}/${message.to}/${message.messageHash}.json`;
  const body = Buffer.from(JSON.stringify(message, null, 2), 'utf8').toString('base64');
  const output = ghApi(executable, ['--method', 'PUT', `repos/${DT_GITHUB_REPO}/contents/${repoPath}`,
    '-f', `message=Route DT peer message ${message.messageHash.slice(0, 12)}`,
    '-f', `content=${body}`, '-f', 'branch=main']);
  const parsed = JSON.parse(output);
  return { commitSha: parsed.commit?.sha || null, path: parsed.content?.path || repoPath };
}

function pollPeerChatInbound(captureSessionId) {
  const executable = githubCliExecutable();
  if (!executable) throw new Error('GitHub CLI is required for temporary peer-chat transport');
  const connected = connectedPeers();
  const connectedIds = new Set(connected.map(peer => peer.executiveId));
  const ingested = new Set(vault.all().filter(row => row.kind === 'peer-message-ingested').map(row => row.data?.messageHash).filter(Boolean));
  const received = [];
  for (const peer of connected) {
    let listing = [];
    try { listing = JSON.parse(ghApi(executable, [`repos/${DT_GITHUB_REPO}/contents/${PEER_CHAT_INBOUND_PATH}/${peer.executiveId}?ref=main`])); }
    catch { continue; }
    for (const item of listing.filter(row => row.type === 'file' && row.name.endsWith('.json'))) {
      const message = JSON.parse(readGithubMailboxFile(executable, `${PEER_CHAT_INBOUND_PATH}/${peer.executiveId}/${item.name}`));
      if (!verifyPeerMessage(message) || message.from !== peer.executiveId || !connectedIds.has(message.to)) continue;
      if (message.captureSessionId !== captureSessionId || ingested.has(message.messageHash)) continue;
      appendLocalPeerMessage(message); ingested.add(message.messageHash); received.push(message);
      vault.append('peer-message-ingested', 'dt-peer-chat', { messageHash: message.messageHash,
        from: message.from, to: message.to, captureSessionId, transport: 'github-temporary-mailbox' });
    }
  }
  return received;
}

function registerIPC(registry) {
  ipcMain.handle('ai-mailbox:status', () => ({
    root: driveStreamingRoot(),
    peers: AI_MAILBOX_PEERS.map(peerId => {
      const root = aiMailboxRoot(peerId);
      return {
        peerId,
        root,
        inbound: fs.readdirSync(path.join(root, 'inbound')).filter(name => name.endsWith('.json')).length,
        outbound: fs.readdirSync(path.join(root, 'outbound')).filter(name => name.endsWith('.json')).length
      };
    })
  }));
  ipcMain.handle('ai-mailbox:write', (_event, request = {}) => {
    const peerId = String(request.peerId || '').toLowerCase();
    const direction = request.direction === 'inbound' ? 'inbound' : 'outbound';
    return writeAiMailbox(peerId, direction, request.payload || {});
  });
  ipcMain.handle('ai-mailbox:read', (_event, request = {}) => readAiMailbox(String(request.peerId || '').toLowerCase(), request.direction || 'inbound'));

  ipcMain.handle('hub:status', () => ({ ...gateway.status(), port: gateway.port }));
  ipcMain.handle('agents:list', () => registry.list().map(agent => ({
    ...agent,
    schema: schemas[agent.id],
    brief: briefs[agent.id]
  })));
  ipcMain.handle('operations:snapshot', () => operationsSnapshot());
  ipcMain.handle('peer:connections', () => {
    const peers = connectedPeers();
    return { peers, count: peers.length, chatEnabled: peers.length >= 2, gatewayAuthority: 'DT_PLATFORM' };
  });
  ipcMain.handle('peer:chat:list', () => ({ messages: listLocalPeerMessages(300), peers: connectedPeers() }));
  ipcMain.handle('peer:chat:poll', (_event, request = {}) => {
    const captureSessionId = String(request.captureSessionId || '');
    if (!activeCaptureSessions.has(captureSessionId)) throw new Error('Active DT capture is required for peer chat');
    const peers = connectedPeers();
    if (peers.length < 2) throw new Error('At least two connected peer executives are required');
    const received = pollPeerChatInbound(captureSessionId);
    return { received, messages: listLocalPeerMessages(300), peers };
  });
  ipcMain.handle('peer:chat:send', (_event, request = {}) => {
    const captureSessionId = String(request.captureSessionId || '');
    if (!activeCaptureSessions.has(captureSessionId)) throw new Error('Active DT capture is required for peer chat');
    const peers = connectedPeers(); const ids = new Set(peers.map(peer => peer.executiveId));
    if (peers.length < 2) throw new Error('At least two connected peer executives are required');
    if (!ids.has(request.from) || !ids.has(request.to)) throw new Error('Both peer-chat participants must be connected');
    const message = createPeerMessage({ from: request.from, to: request.to, text: request.text, captureSessionId });
    appendLocalPeerMessage(message);
    const published = publishPeerChatMessage(message);
    vault.append('peer-message-sent', 'dt-peer-chat', { messageHash: message.messageHash,
      from: message.from, to: message.to, captureSessionId, published, executionAuthority: false, mouseAuthority: false });
    return { message, published };
  });
  ipcMain.handle('capture:sources', async () => (await desktopCapturer.getSources({
    types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 }, fetchWindowIcons: false
  })).map(source => ({ id: source.id, name: source.name, displayId: source.display_id || null })));
  ipcMain.handle('capture:start', (_event, request = {}) => {
    const task = String(request.task || '').trim();
    if (!task) throw new Error('Describe the authorized capture task first');
    const sessionId = require('node:crypto').randomUUID();
    const root = path.join(dataRoot(), 'screen-captures', sessionId);
    fs.mkdirSync(root, { recursive: true });
    const manifest = {
      schema: 'dt-session-capture/1.0', sessionId, task,
      agentId: request.agentId || null, captureSourceId: request.sourceId || null,
      startedAt: new Date().toISOString(),
      consent: 'USER_INITIATED_VISIBLE_CAPTURE', status: 'RECORDING', chunks: 0,
      manager: 'SESSION_CAPTURE_MANAGER', covertCapturePermitted: false
    };
    fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2));
    vault.append('capture-started', 'session-capture-manager', manifest);
    activeCaptureSessions.add(sessionId);
    return { sessionId, startedAt: manifest.startedAt };
  });
  ipcMain.handle('capture:append', (_event, sessionId, chunk) => {
    if (!/^[0-9a-f-]{36}$/i.test(String(sessionId || ''))) throw new Error('Invalid capture session');
    const root = path.join(dataRoot(), 'screen-captures', sessionId);
    const manifestPath = path.join(root, 'manifest.json');
    if (!fs.existsSync(manifestPath)) throw new Error('Unknown capture session');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.status !== 'RECORDING') throw new Error('Capture session is closed');
    fs.appendFileSync(path.join(root, 'screen.webm'), Buffer.from(chunk));
    manifest.chunks += 1;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    return { chunks: manifest.chunks };
  });
  ipcMain.handle('capture:stop', (_event, sessionId, status = 'COMPLETED') => {
    if (!/^[0-9a-f-]{36}$/i.test(String(sessionId || ''))) throw new Error('Invalid capture session');
    const root = path.join(dataRoot(), 'screen-captures', sessionId);
    const manifestPath = path.join(root, 'manifest.json');
    if (!fs.existsSync(manifestPath)) throw new Error('Unknown capture session');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.stoppedAt = new Date().toISOString();
    manifest.status = status === 'FAILED' ? 'FAILED_PRESERVED' : 'COMPLETED';
    const videoPath = path.join(root, 'screen.webm');
    manifest.videoBytes = fs.existsSync(videoPath) ? fs.statSync(videoPath).size : 0;
    manifest.videoSha256 = fs.existsSync(videoPath)
      ? require('node:crypto').createHash('sha256').update(fs.readFileSync(videoPath)).digest('hex') : null;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    activeCaptureSessions.delete(sessionId);
    for (const [token, action] of pendingControlActions) if (action.sessionId === sessionId) pendingControlActions.delete(token);
    const receipt = vault.append('capture-stopped', 'session-capture-manager', manifest);
    return { manifest, receipt };
  });
  ipcMain.handle('peer:grok:handshake', async (_event, request = {}) => {
    const captureSessionId = String(request.captureSessionId || '');
    if (!activeCaptureSessions.has(captureSessionId)) throw new Error('Active DT capture is required for Grok handshake');
    const login = authenticatedGithubLogin();
    if (!isOwner(ownerProfile, login)) throw new Error('Verified owner GitHub identity is required');
    const found = findGrokProposalForCapture(captureSessionId, 'command.propose');
    if (!found) return { status: 'WAITING_FOR_GROK_PROPOSAL', connectionStatus: 'NOT_CONNECTED', captureSessionId };
    const proposal = found.proposal;
    if (proposalWasConsumed(vault.all(), proposal.proposalHash)) {
      return { status: 'REPLAY_BLOCKED_ALREADY_CONSUMED', connectionStatus: 'LIVE_PROOF_PENDING_GROK_ACK',
        proposalHash: proposal.proposalHash, captureSessionId };
    }
    const confirmation = await dialog.showMessageBox({
      type: 'warning',
      title: 'Authorize one Grok handshake',
      message: 'DT found a Grok peer proposal for the active recorded task.',
      detail: `Proposal: ${proposal.proposalHash}\nCapability: ${proposal.capability}\nCommand: ${proposal.payload?.command || '(none)'}\n\nAuthorize exactly one bounded execution?`,
      buttons: ['Cancel', 'Authorize once'], defaultId: 0, cancelId: 0, noLink: true
    });
    const prepared = prepareGrokHandshake(proposal, {
      ownerApproved: confirmation.response === 1,
      dtAuthenticated: true,
      activeCaptureSessionIds: [...activeCaptureSessions]
    });
    if (!prepared.accepted) {
      const refused = createReceipt(proposal, prepared, { transport: 'github', executed: false, resultValidated: false });
      const published = publishGrokReceipt(refused, 'handshake');
      vault.append('grok-peer-handshake-refused', 'dt-hub', { ...refused, published });
      return { status: 'REFUSED', connectionStatus: 'NOT_CONNECTED', receipt: refused, published };
    }
    if (proposalWasConsumed(vault.all(), proposal.proposalHash)) {
      return { status: 'REPLAY_BLOCKED_ALREADY_CONSUMED', connectionStatus: 'LIVE_PROOF_PENDING_GROK_ACK',
        proposalHash: proposal.proposalHash, captureSessionId };
    }
    vault.append('grok-peer-handshake-consumed', 'dt-hub', {
      proposalFile: found.fileName, proposalHash: proposal.proposalHash, captureSessionId,
      consumedAt: new Date().toISOString(), rule: 'SINGLE_USE_OWNER_AUTHORIZATION'
    });
    const execution = runGrokHandshakeCommand(prepared.envelope.payload.command);
    const result = execution.result;
    const resultHash = crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex');
    const resultValidated = result.session_id === 'grok-ceo' && result.exit_code === 0 && String(result.stdout || '').trim() === 'GROK_CEO_PING';
    const returned = createReceipt(proposal, prepared, {
      transport: 'github', executed: result.exit_code !== null,
      officialRequestId: prepared.envelope.requestId, officialRequestHash: prepared.envelope.requestHash,
      bridgeRequestId: execution.bridgeRequestId, exitCode: result.exit_code,
      stdout: result.stdout || '', stderr: result.stderr || '', resultHash, resultValidated
    });
    const published = publishGrokReceipt(returned, 'handshake');
    vault.append('grok-peer-handshake-executed', 'dt-hub', {
      proposalFile: found.fileName, proposalHash: proposal.proposalHash,
      officialRequestId: prepared.envelope.requestId, officialRequestHash: prepared.envelope.requestHash,
      captureSessionId, bridgeRequestId: execution.bridgeRequestId, resultHash, resultValidated,
      receiptHash: returned.receiptHash, published
    });
    return { status: resultValidated ? 'RESULT_RETURNED_AWAITING_GROK_ACK' : 'EXECUTION_RESULT_INVALID',
      connectionStatus: returned.connectionStatus, receipt: returned, published };
  });
  ipcMain.handle('peer:grok:command', async (_event, request = {}) => {
    const captureSessionId = String(request.captureSessionId || '');
    if (!activeCaptureSessions.has(captureSessionId)) throw new Error('Active DT capture is required for Grok commands');
    if (!connectedPeers().some(peer => peer.executiveId === 'grok-ceo')) throw new Error('grok-ceo is not in CONNECTED state');
    const login = authenticatedGithubLogin();
    if (!isOwner(ownerProfile, login)) throw new Error('Verified owner GitHub identity is required');
    const available = findGrokProposalsForCapture(captureSessionId, 'command.execute')
      .filter(item => !commandProposalWasConsumed(vault.all(), item.proposal.proposalHash));
    if (!available.length) return { status: 'WAITING_FOR_GROK_COMMAND', connectionStatus: 'CONNECTED', captureSessionId };
    const found = available[0], proposal = found.proposal;
    const policyContext = { allowedRoots: commandAllowedRoots(), defaultCwd: process.env.USERPROFILE || '' };
    const prism = prismCommandDecision(proposal, policyContext);
    let ownerApproved = false;
    if (prism.allowed && prism.approvalRequired) {
      const confirmation = await dialog.showMessageBox({
        type: 'warning', title: 'Authorize one Grok command',
        message: 'DT Prism requires owner approval for this command.',
        detail: `Command: ${prism.normalized?.command || '(none)'}
CWD: ${prism.normalized?.cwd || '(none)'}
Risk: ${prism.risk?.level || 'UNKNOWN'}

Authorize exactly one execution?`,
        buttons: ['Cancel', 'Authorize once'], defaultId: 0, cancelId: 0, noLink: true
      });
      ownerApproved = confirmation.response === 1;
    }
    const prepared = prepareGrokCommand(proposal, { ...policyContext, ownerApproved,
      dtAuthenticated: true, activeCaptureSessionIds: [...activeCaptureSessions] });
    if (!prepared.accepted) {
      const refused = createCommandReceipt(proposal, prepared, { ownerApproved, executed: false });
      const published = publishGrokReceipt(refused, 'command');
      vault.append('grok-peer-command-refused', 'dt-hub', { proposalFile: found.fileName,
        proposalHash: proposal.proposalHash, captureSessionId, reason: prepared.reason, receiptHash: refused.receiptHash, published });
      return { status: 'COMMAND_REFUSED', connectionStatus: 'CONNECTED', receipt: refused, published };
    }
    if (commandProposalWasConsumed(vault.all(), proposal.proposalHash)) {
      return { status: 'REPLAY_BLOCKED_ALREADY_CONSUMED', connectionStatus: 'CONNECTED', proposalHash: proposal.proposalHash };
    }
    vault.append('grok-peer-command-consumed', 'dt-hub', { proposalFile: found.fileName,
      proposalHash: proposal.proposalHash, captureSessionId, consumedAt: new Date().toISOString(), rule: 'SINGLE_USE_COMMAND_PROPOSAL' });
    const normalized = prepared.envelope.payload;
    const execution = runGrokCommand(normalized.command, normalized.cwd, normalized.timeoutSeconds);
    const result = execution.result;
    const resultHash = crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex');
    const returned = createCommandReceipt(proposal, prepared, { ownerApproved, executed: result.exit_code !== null,
      officialRequestId: prepared.envelope.requestId, officialRequestHash: prepared.envelope.requestHash,
      bridgeRequestId: execution.bridgeRequestId, exitCode: result.exit_code,
      stdout: result.stdout || '', stderr: result.stderr || '', resultHash });
    const published = publishGrokReceipt(returned, 'command');
    vault.append('grok-peer-command-executed', 'dt-hub', { proposalFile: found.fileName,
      proposalHash: proposal.proposalHash, captureSessionId, bridgeRequestId: execution.bridgeRequestId,
      officialRequestId: prepared.envelope.requestId, officialRequestHash: prepared.envelope.requestHash,
      resultHash, exitCode: result.exit_code, receiptHash: returned.receiptHash, published });
    return { status: 'COMMAND_RESULT_RETURNED', connectionStatus: 'CONNECTED', receipt: returned, published };
  });
  ipcMain.handle('control:queue', (_event, request = {}) => {
    const sessionId=String(request.sessionId||'');
    if(!activeCaptureSessions.has(sessionId)) throw new Error('Active task capture required');
    const action=String(request.action||'').toUpperCase();
    if(!['MOVE','LEFT_CLICK','RIGHT_CLICK','SCROLL'].includes(action)) throw new Error('Unsupported cursor action');
    const x=Number(request.x), y=Number(request.y), scrollAmount=Number(request.scrollAmount||0);
    if(!Number.isInteger(x)||!Number.isInteger(y)) throw new Error('Integer screen coordinates required');
    const inside=screen.getAllDisplays().some(display=>x>=display.bounds.x&&y>=display.bounds.y&&
      x<display.bounds.x+display.bounds.width&&y<display.bounds.y+display.bounds.height);
    if(!inside) throw new Error('Coordinates are outside connected displays');
    if(action==='SCROLL'&&(!Number.isInteger(scrollAmount)||Math.abs(scrollAmount)>1200||scrollAmount===0)) {
      throw new Error('Scroll must be a nonzero integer from -1200 to 1200');
    }
    const token=require('node:crypto').randomUUID();
    const queued={token,sessionId,action,x,y,scrollAmount,queuedAt:new Date().toISOString(),expiresAt:Date.now()+60000};
    pendingControlActions.set(token,queued);
    vault.append('cursor-action-queued','desktop-control',{...queued,token:'REDACTED_SINGLE_USE'});
    return {...queued,expiresAt:new Date(queued.expiresAt).toISOString()};
  });
  ipcMain.handle('control:cancel', (_event, token, reason = 'USER_ABANDONED') => {
    const queued=pendingControlActions.get(String(token||''));
    if(!queued) throw new Error('Unknown or already-resolved cursor approval');
    pendingControlActions.delete(queued.token);
    const event={sessionId:queued.sessionId,action:queued.action,x:queued.x,y:queued.y,
      canceledAt:new Date().toISOString(),result:String(reason||'USER_ABANDONED').slice(0,80)};
    const eventFile=path.join(dataRoot(),'screen-captures',queued.sessionId,'control-events.jsonl');
    fs.appendFileSync(eventFile,JSON.stringify({type:'CURSOR_ACTION_NOT_EXECUTED',...event})+'\n','utf8');
    const receipt=vault.append('cursor-action-canceled','desktop-control',event);
    return {event,receipt};
  });
  ipcMain.handle('control:execute', (_event, token) => {
    const queued=pendingControlActions.get(String(token||''));
    if(!queued) throw new Error('Unknown or already-used cursor approval');
    pendingControlActions.delete(queued.token);
    if(Date.now()>queued.expiresAt) throw new Error('Cursor approval expired');
    if(!activeCaptureSessions.has(queued.sessionId)) throw new Error('Task capture ended before execution');
    const flags=queued.action==='LEFT_CLICK'?[2,4]:queued.action==='RIGHT_CLICK'?[8,16]:[];
    const operation=queued.action==='MOVE'
      ? '[Cursor]::SetCursorPos('+queued.x+','+queued.y+') | Out-Null'
      : queued.action==='SCROLL'
        ? '[Cursor]::SetCursorPos('+queued.x+','+queued.y+') | Out-Null; Start-Sleep -Milliseconds 120; [Cursor]::mouse_event(2048,0,0,'+queued.scrollAmount+',[UIntPtr]::Zero)'
        : '[Cursor]::SetCursorPos('+queued.x+','+queued.y+') | Out-Null; Start-Sleep -Milliseconds 120; [Cursor]::mouse_event('+flags[0]+',0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 80; [Cursor]::mouse_event('+flags[1]+',0,0,0,[UIntPtr]::Zero)';
    const ps='Add-Type -TypeDefinition @"\nusing System; using System.Runtime.InteropServices; public static class Cursor { [DllImport("user32.dll")] public static extern bool SetCursorPos(int X,int Y); [DllImport("user32.dll")] public static extern void mouse_event(uint f,uint dx,uint dy,int data,UIntPtr extra); }\n"@; '+operation;
    try {
      execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{windowsHide:true,timeout:5000});
    } catch (error) {
      const failure={sessionId:queued.sessionId,action:queued.action,x:queued.x,y:queued.y,
        scrollAmount:queued.scrollAmount,failedAt:new Date().toISOString(),result:'NATIVE_EXECUTION_FAILED',
        errorName:error.name||'Error',errorMessage:String(error.message||error).slice(0,2000)};
      const failureFile=path.join(dataRoot(),'screen-captures',queued.sessionId,'control-events.jsonl');
      fs.appendFileSync(failureFile,JSON.stringify({type:'CURSOR_EXECUTION_FAILURE',...failure})+'\n','utf8');
      vault.append('cursor-action-failed','desktop-control',failure);
      throw new Error('Native cursor execution failed; failure evidence was preserved.');
    }
    const event={sessionId:queued.sessionId,action:queued.action,x:queued.x,y:queued.y,
      scrollAmount:queued.scrollAmount,executedAt:new Date().toISOString(),result:'EXECUTED_NOT_OUTCOME_VERIFIED'};
    const eventFile=path.join(dataRoot(),'screen-captures',queued.sessionId,'control-events.jsonl');
    fs.appendFileSync(eventFile,JSON.stringify(event)+'\n','utf8');
    const receipt=vault.append('cursor-action-executed','desktop-control',event);
    return {event,receipt};
  });
  ipcMain.handle('control:test-result', (_event, request = {}) => {
    const sessionId=String(request.sessionId||'');
    if(!activeCaptureSessions.has(sessionId)) throw new Error('Active task capture required to record test result');
    const allowed=['MOVE','LEFT_CLICK','RIGHT_CLICK','SCROLL'];
    const expected=allowed.includes(String(request.expected||'').toUpperCase())?String(request.expected).toUpperCase():null;
    const observed=allowed.includes(String(request.observed||'').toUpperCase())?String(request.observed).toUpperCase():null;
    if(!expected) throw new Error('Valid expected test action required');
    const result={sessionId,expected,observed,status:expected===observed?'PASS':'FAIL_OR_NOT_OBSERVED',recordedAt:new Date().toISOString()};
    const eventFile=path.join(dataRoot(),'screen-captures',sessionId,'control-events.jsonl');
    fs.appendFileSync(eventFile,JSON.stringify({type:'SAFE_TEST_RESULT',...result})+'\n','utf8');
    const receipt=vault.append('cursor-safe-test-result','desktop-control',result);
    return {result,receipt};
  });
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
      supervisor?.recordAgentRun(agentId, receipt, metric, true);
      return { output, receipt, runtimeMetric:metric };
    } catch (error) {
      const metric = { durationMs:Date.now()-startedMs, success:false,
        inputBytes:Buffer.byteLength(JSON.stringify(input || {})), outputBytes:0 };
      const receipt = vault.append('agent-run', agentId, { error:error.message, runtimeMetric:metric });
      supervisor?.recordAgentRun(agentId, receipt, metric, false, error.message);
      throw error;
    } finally { activeRuns.delete(runId); }
  });
  ipcMain.handle('workflow:route', (_event, request) => {
    const result = routeTask(request, broker, vault);
    supervisor?.recordWorkflow('route', result);
    return result;
  });
  ipcMain.handle('workflow:execute', async (_event, request) => {
    const result = await executeWorkflow(request, broker, vault);
    supervisor?.recordWorkflow('execute', result);
    return result;
  });
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
    const serialized = JSON.stringify(bundle, null, 2);
    fs.writeFileSync(chosen.filePath, serialized, 'utf8');
    const signing = provenanceKeys();
    const seal = createSeal({ bytes: Buffer.from(serialized),
      owner: 'Thomas “TJ” Cutler', disclosure: 'Human-directed DT work; AI assistance disclosed by owner as appropriate.',
      sourceClass: 'CONSUMER_OWNED_DT_VAULT_EXPORT', ...signing });
    const sealPath = chosen.filePath + '.dt-seal.json';
    fs.writeFileSync(sealPath, JSON.stringify(seal, null, 2), 'utf8');
    appendSeal(vault, seal);
    vault.append('vault-exported', 'memory', {
      fileName: path.basename(chosen.filePath), sealFileName: path.basename(sealPath),
      recordCount: bundle.recordCount, bundleHash: bundle.bundleHash, sealHash: seal.sealHash
    });
    return { canceled: false, filePath: chosen.filePath, sealPath,
      recordCount: bundle.recordCount, bundleHash: bundle.bundleHash, sealHash: seal.sealHash };
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
    const { provider, model, baseUrl, prompt, agentId, input, captureSessionId } = request;
    if (!String(prompt || '').trim()) throw new Error('Question required');
    if (!activeCaptureSessions.has(String(captureSessionId || ''))) {
      throw new Error('Active user-visible DT task capture is required for connected AI work');
    }
    const definition = providerDefinition(provider, baseUrl ? { baseUrl } : {});
    const agent = registry.get(agentId);
    const brief = briefs[agentId];
    const system = [
      'You are connected as an authorized peer intelligence node through the local DT Platform.',
      'The DT Platform itself is the provider-neutral gateway and authority plane. MCP, APIs, sockets, and provider-specific connectors are edge adapters only.',
      'Authorized peer AI providers have equal executive standing with one another unless the human owner explicitly assigns a narrower role for a task. Do not silently supersede, demote, terminate, or expand another peer AI node.',
      'Human owner authority, DT identity/governance, Prism policy, and provenance remain above provider execution.',
      'Preserve sources, contradictions, failed branches, uncertainty, peer disagreements, and consumer authority.',
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
      provider, model, prompt: prompt.trim(), response: response.text, safety,
      captureSessionId, executiveStanding: 'PEER', gatewayAuthority: 'DT_PLATFORM'
    });
    return { text: response.text, safety, receipt };
  });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const localWindow = webContents.getURL().startsWith('file:');
    callback(localWindow && (permission === 'display-capture' || permission === 'media'));
  });
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    callback({});
  }, { useSystemPicker: true });
  const root = dataRoot();
  vault = new Vault(root);
  keys = new KeyAuthority(path.join(root, 'authority'));
  recovery = new RecoveryAuthority(path.join(root, 'authority'), keys, ownerProfile.githubLogin);
  const registry = new AgentRegistry(agents);
  broker = new Broker(vault, registry);
  gateway = createGateway({ keys, vault, broker, agents: registry });
  gateway.start();
  supervisor = new EmbeddedSupervisor({ app, vault, agents });
  supervisor.start();
  registerIPC(registry);
  const flag = process.argv.find(arg => arg.startsWith('--agent='));
  createWindow(flag ? flag.slice(8) : null);
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on('before-quit', () => supervisor?.stop());

app.on('window-all-closed', () => {
  gateway?.stop();
  if (process.platform !== 'darwin') app.quit();
});
