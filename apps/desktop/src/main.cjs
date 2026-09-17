const { app, BrowserWindow, ipcMain, safeStorage, dialog, screen, session, desktopCapturer, Tray, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const os = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');
const { Vault } = require('../../../packages/core/src/vault.cjs');
const { AgentRegistry } = require('../../../packages/core/src/registry.cjs');
const { Broker } = require('../../../packages/core/src/broker.cjs');
const { KeyAuthority } = require('../../../packages/core/src/keys.cjs');
const { createGateway } = require('../../../packages/core/src/gateway.cjs');
const { AdapterStatusRegistry, summarizeAdapterState } = require('../../../packages/core/src/adapter-status.cjs');
const { TerminalRuntime } = require('../../../packages/core/src/terminal-runtime.cjs');
const { CapabilityBus } = require('../../../packages/core/src/capability-bus.cjs');
const { registerCoreCapabilities } = require('../../../packages/core/src/core-capabilities.cjs');
const { LearnedSkillRegistry, compileTeacherReply, executeSkill, teacherPrompt } = require('../../../packages/core/src/learned-skills.cjs');
const { DTLocalIntelligence } = require('../../../packages/core/src/local-intelligence.cjs');
const { PromptRuntime } = require('../../../packages/core/src/prompt-runtime.cjs');
const { runHeadlessCommand } = require('../../../packages/core/src/headless-command.cjs');
const { ExperienceLedger } = require('../../../packages/core/src/experience-ledger.cjs');
const { ResidentRuntime } = require('../../../packages/core/src/resident-runtime.cjs');
const { DTBootstrap } = require('../../../packages/core/src/bootstrap.cjs');
const { createLocalProcedure } = require('../../../packages/core/src/training.cjs');
const { createBundle, verifyBundle } = require('../../../packages/core/src/portable.cjs');
const { readDirtySession, markSessionDirty, clearSessionDirty } = require('../../../packages/core/src/session-recovery.cjs');
const { appendSeal, createSeal } = require('../../../packages/core/src/provenance.cjs');
const { createReceipt } = require('../../../packages/core/src/peer-mailbox.cjs');
const { prepareGrokHandshake, proposalWasConsumed } = require('../../../packages/core/src/grok-handshake.cjs');
const { prepareGrokCommand, prismCommandDecision, commandProposalWasConsumed, createCommandReceipt, commandRisk } = require('../../../packages/core/src/grok-command.cjs');
const { createPeerMessage, verifyPeerMessage } = require('../../../packages/core/src/peer-chat.cjs');
const { manifest: grokRemoteCliManifest, activationState: grokRemoteCliActivationState } = require('../../../packages/plugins/grok-remote-cli/index.cjs');
const { listPeerExecutives } = require('../../../packages/auth/src/peers.cjs');
const { RecoveryAuthority } = require('../../../packages/auth/src/recovery.cjs');
const { createLocalUser, verifyPassword, verifyRecovery } = require('../../../packages/auth/src/local-user.cjs');
const { ownerBootstrap, isOwner } = require('../../../packages/auth/src/policy.cjs');
const { agents } = require('../../../packages/tools/src/agents.cjs');
const { schemas } = require('../../../packages/tools/src/schemas.cjs');
const { briefs } = require('../../../packages/tools/src/briefs.cjs');
const { runAgent } = require('../../../packages/tools/src/runner.cjs');
const { EmbeddedSupervisor } = require('../../../packages/tools/src/supervisor.cjs');
const { routeTask, executeWorkflow } = require('../../../packages/tools/src/workflow.cjs');
const { inboxFor, processInbox } = require('../../../packages/tools/src/inbox.cjs');
const { preflight } = require('../../../packages/safety/src/preflight.cjs');
const { PROVIDERS, providerDefinition, buildRequest, requestAI } = require('../../../packages/providers/src/index.cjs');
const { listSimulations, replaySimulation } = require('../../../packages/simulations/src/replay.cjs');

const utilityMode = process.argv.includes('--grok-provider-ping');
if (utilityMode) app.setPath('userData', path.join(process.env.APPDATA, 'dt-desktop-suite'));

let mainWindow = null;
let pendingAgentSelection = (process.argv.find(arg => arg.startsWith('--agent=')) || '').slice(8) || null;
let pendingShellView = (process.argv.find(arg => arg.startsWith('--view=')) || '').slice(7) || null;
if (!utilityMode) {
  const lock = app.requestSingleInstanceLock();
  if (!lock) app.quit();
  else app.on('second-instance', (_event, argv) => {
    const flag = argv.find(arg => arg.startsWith('--agent='));
    const viewFlag = argv.find(arg => arg.startsWith('--view='));
    const agentId = flag ? flag.slice(8) : null;
    const view = viewFlag ? viewFlag.slice(7) : null;
    if (!mainWindow || mainWindow.isDestroyed()) { createWindow(agentId, view); return; }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show(); mainWindow.focus();
    if (agentId) mainWindow.webContents.send('shell:select-agent', agentId);
    if (view) mainWindow.webContents.send('shell:set-view', view);
  });
}

let vault, keys, broker, gateway, recovery, supervisor, adapters, terminals, capabilityBus, skillRegistry, localIntelligence, promptRuntime, experience, residentRuntime, bootstrapState, tray;
let isQuitting = false;
let localUserAuthenticated = false;
let cleanCloseout = false;
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

function localUserFile(){ return path.join(dataRoot(),'credentials','local-user.bin'); }
function loadLocalUser(){
  const file=localUserFile(); if(!fs.existsSync(file)) return null;
  if(!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption unavailable for local user profile');
  return JSON.parse(safeStorage.decryptString(fs.readFileSync(file)));
}
function saveLocalUser(record){
  if(!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption unavailable for local user profile');
  const file=localUserFile(); fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,safeStorage.encryptString(JSON.stringify(record))); return record;
}
function localUserStatus(){
  const record=loadLocalUser(); const trusted=record?.signInMode==='TRUST_THIS_DEVICE';
  return {exists:!!record,username:record?.username||null,signInMode:record?.signInMode||'EVERY_LAUNCH',authenticated:!!record&&(localUserAuthenticated||trusted)};
}
function automaticRecoveryExport(reason){
  if(!vault) return null;
  const entries=vault.all(); const bundle=createBundle(entries,{application:'DT Desktop Suite',reason,automatic:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const dir=path.join(process.env.USERPROFILE,'Documents','DT Exports','auto-recovery-'+stamp); fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,'DT-Consumer-Vault.json'); fs.writeFileSync(file,JSON.stringify(bundle,null,2),'utf8');
  const verified=verifyBundle(JSON.parse(fs.readFileSync(file,'utf8')));
  fs.writeFileSync(path.join(dir,'recovery-manifest.json'),JSON.stringify({reason,createdAt:new Date().toISOString(),recordCount:entries.length,bundleHash:bundle.bundleHash,verification:verified},null,2),'utf8');
  return {path:file,recordCount:entries.length,bundleHash:bundle.bundleHash,verification:verified};
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


function seedRecoveredAdapterEvidence() {
  if (!adapters) return;
  const roots = [process.env.DT_GROK_SYNC_ROOT, 'C:\\DT\\GoogleDrive\\My Drive\\GROK_DT_SYNC'].filter(Boolean);
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const ping = path.join(root, '20260917T_CORRECTED__GROK_SYNC__COFFEEMAKER_PROVIDER_PING__RECEIPT.md');
    if (fs.existsSync(ping)) {
      const text = fs.readFileSync(ping, 'utf8');
      adapters.record('xai-provider', {
        adapter: 'xai', implementationComplete: true,
        status: /Status:\s*PONG_RECEIVED/i.test(text) ? 'PONG_RECEIVED' : 'PROOF_PRESENT_UNVERIFIED',
        httpStatus: Number((/HTTP status:\s*(\d+)/i.exec(text) || [])[1] || 0) || null,
        outcomeVerified: /Status:\s*PONG_RECEIVED/i.test(text), evidencePath: ping
      });
    }
    const cli = path.join(root, '20260917T140918EDT__GROK_SYNC__REMOTE_CLI_PROOF__RESULT.json');
    if (fs.existsSync(cli)) {
      try {
        const proof = JSON.parse(fs.readFileSync(cli, 'utf8'));
        adapters.record('grok-remote-cli', {
          adapter: 'grok-remote-cli', implementationComplete: true,
          outcomeVerified: proof.outcomeVerified === true, providerHttpStatus: proof.providerHttpStatus,
          proofHash: proof.proofHash || null, resultHash: proof.resultHash || null,
          standingLease: false, evidencePath: cli
        });
      } catch {}
    }
  }
}



function localSkillRuntime(ownerApproved = false) {
  return {
    ownerApproved,
    runAgent: async (agentId, input) => {
      const started = Date.now();
      try {
        const output = runAgent(agentId, input || {});
        const receipt = vault.append('agent-run', agentId, {
          ...output, invokedBy: 'dt-local-skill',
          runtimeMetric: { durationMs: Date.now()-started, success: true, inputBytes: 0, outputBytes: 0 }
        });
        experience?.append('agent-run', { agentId, input, success: true, receiptId: receipt.id });
        return { output, receipt };
      } catch (error) {
        experience?.append('agent-run', { agentId, input, success: false, error: String(error.message || error) });
        residentRuntime?.submitIncident({ source: 'agent.run', agentId, error: String(error.stack || error) });
        throw error;
      }
    },
    executeWorkflow: async request => executeWorkflow(request, broker, vault),
    callTool: async (toolId, input) => capabilityBus.call(toolId, input || {}, { ownerApproved }),
    runCommand: async (step, input) => {
      const result = runHeadlessCommand(step, input || {}, {
        ownerApproved,
        defaultCwd: bootstrapState?.environment?.home || process.env.USERPROFILE,
        allowedRoots: [bootstrapState?.environment?.home,
          ...(bootstrapState?.environment?.googleDrive || []).map(item => item.root)].filter(Boolean)
      });
      experience?.append('headless-command', {
        command: result.command, cwd: result.cwd, exitCode: result.exitCode,
        stdout: result.stdout, stderr: result.stderr, success: result.exitCode === 0
      }, { invokedBy: 'dt-local-skill' });
      if (result.exitCode !== 0 || result.error) residentRuntime?.submitIncident({
        source: 'learned-skill-command', command: result.command, cwd: result.cwd,
        exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr, error: result.error
      });
      return result;
    }
  };
}


function createTray() {
  if (tray) return tray;
  const icon = path.join(__dirname, '..', 'assets', 'icons', 'suite.ico');
  tray = new Tray(icon);
  tray.setToolTip('DT Desktop Suite — resident runtime active');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open DT', click: () => createWindow() },
    { label: 'Command shells', click: () => createWindow(null, 'terminals') },
    { type: 'separator' },
    { label: 'Quit DT Platform', click: () => { isQuitting = true; app.quit(); } }
  ]));
  tray.on('double-click', () => createWindow());
  return tray;
}

function createWindow(agentId = null, view = null) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (agentId) mainWindow.webContents.send('shell:select-agent', agentId);
    if (view) mainWindow.webContents.send('shell:set-view', view);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show(); mainWindow.focus();
    return mainWindow;
  }
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 980, minHeight: 640,
    backgroundColor: '#070914',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  const query = {}; if (agentId) query.agent = agentId; if (view) query.view = view;
  mainWindow.loadFile(path.join(__dirname, 'index.html'), { query });
  mainWindow.on('close', event => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  return mainWindow;
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

  ipcMain.handle('training:save-local', (_event, request = {}) => {
    const procedure = createLocalProcedure(request.observation, {
      agentId: request.agentId || null, title: request.title || null
    });
    const root = path.join(dataRoot(), 'training', 'procedures');
    fs.mkdirSync(root, { recursive: true });
    const target = path.join(root, procedure.id + '.json');
    const temp = target + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(procedure, null, 2), 'utf8');
    fs.renameSync(temp, target);
    const receipt = vault.append('local-procedure-learned', 'dt-training-bot', {
      procedureId: procedure.id, agentId: procedure.context.agentId, requiresAI: false,
      executionMode: procedure.executionMode, path: target
    });
    return { procedure, receipt, path: target };
  });

  ipcMain.handle('bootstrap:status', () => bootstrapState);
  ipcMain.handle('capabilities:list', () => capabilityBus.list());
  ipcMain.handle('runtime:status', async () => ({
    resident: residentRuntime?.status() || { running: false },
    localModel: await localIntelligence.status(),
    bootstrap: bootstrapState,
    learnedSkills: skillRegistry.list().map(skill => ({
      id: skill.id, name: skill.name, state: skill.state,
      requiresAIAtRuntime: skill.requiresAIAtRuntime, skillHash: skill.skillHash
    }))
  }));
  ipcMain.handle('prompt:run', async (_event, request = {}) => {
    const prompt = String(request.prompt || '').trim();
    experience.append('user-prompt', { prompt, input: request.input || {} }, { surface: 'dt-prompt' });
    try {
      const result = await promptRuntime.handle({
        prompt, input: request.input || {},
        runtime: localSkillRuntime(request.ownerApproved === true)
      });
      experience.append('prompt-result', { prompt, result }, { surface: 'dt-prompt' });
      return result;
    } catch (error) {
      const failure = { source: 'prompt.run', prompt, error: String(error.stack || error) };
      experience.append('prompt-failure', failure, { surface: 'dt-prompt' });
      residentRuntime?.submitIncident(failure);
      throw error;
    }
  });

  ipcMain.handle('training:teacher-prompt', (_event, request = {}) => ({
    prompt: teacherPrompt(request.observation, {
      knownAgents: registry.list().map(agent => agent.id),
      knownTools: capabilityBus.list().map(tool => tool.id)
    }),
    knownAgents: registry.list().map(agent => agent.id),
    knownTools: capabilityBus.list().map(tool => tool.id),
    target: 'LOCAL_EXECUTABLE_SKILL', requiresAIAtRuntime: false
  }));
  ipcMain.handle('training:compile-teacher-reply', (_event, request = {}) => {
    const skill = compileTeacherReply(request.reply, {
      teacher: request.teacher || 'external-ai',
      knownAgents: registry.list().map(agent => agent.id),
      knownTools: capabilityBus.list().map(tool => tool.id)
    });
    skillRegistry.save(skill);
    experience.append('teacher-skill-candidate', {
      teacher: request.teacher || 'external-ai', skillId: skill.id,
      skillHash: skill.skillHash, name: skill.name, requiresAIAtRuntime: false
    });
    vault.append('learned-skill-candidate', 'dt-training-bot', {
      skillId: skill.id, skillHash: skill.skillHash, teacher: skill.teacher,
      requiresAIAtRuntime: false
    });
    return skill;
  });
  ipcMain.handle('training:list-skills', () => skillRegistry.list());
  ipcMain.handle('training:validate-skill', (_event, request = {}) => {
    const skill = skillRegistry.load(request.skillId);
    if (!skill) throw new Error('Unknown learned skill');
    const unknownTools = skill.steps.filter(step => step.type === 'tool.call' && !capabilityBus.has(step.toolId));
    const unknownAgents = skill.steps.filter(step => step.type === 'agent.run' && !registry.get(step.agentId));
    const blockedCommands = skill.steps.filter(step => step.type === 'command.run' && commandRisk(step.command).level === 'BLOCKED');
    const passed = unknownTools.length === 0 && unknownAgents.length === 0 && blockedCommands.length === 0;
    const validation = {
      passed, validator: 'DT_LOCAL_STATIC_VALIDATOR',
      evidence: { unknownTools: unknownTools.length, unknownAgents: unknownAgents.length,
        blockedCommands: blockedCommands.length, runtimeExecutionTested: false },
      status: passed ? 'STRUCTURE_VALIDATED_RUNTIME_TEST_PENDING' : 'FAILED'
    };
    vault.append('learned-skill-validation', 'dt-training-bot', { skillId: skill.id, ...validation });
    return validation;
  });
  ipcMain.handle('training:promote-skill', (_event, request = {}) => {
    if (request.runtimeTestPassed !== true) throw new Error('Runtime test must pass before promotion');
    const promoted = skillRegistry.promote(request.skillId, {
      passed: true, validator: 'DT_LOCAL_RUNTIME_VALIDATOR', evidence: request.evidence || null
    });
    vault.append('learned-skill-promoted', 'dt-training-bot', {
      skillId: promoted.id, skillHash: promoted.skillHash, requiresAIAtRuntime: false
    });
    return promoted;
  });
  ipcMain.handle('adapter:status', () => {
    const providerProof = adapters.load('xai-provider');
    const cliProof = adapters.load('grok-remote-cli');
    const peerConnected = connectedPeers().some(peer => peer.executiveId === 'grok-ceo');
    const state = summarizeAdapterState({
      credentialStored: fs.existsSync(credentialFile('xai')), providerProof, cliProof,
      peerConnected, standingLease: false
    });
    return {
      xaiProvider: { ...state, proof: providerProof },
      grokRemoteCli: { ...state, proof: cliProof, plugin: grokRemoteCliManifest },
      activation: grokRemoteCliActivationState({
        peerConnected, activeCapture: activeCaptureSessions.size > 0,
        ownerVerified: isOwner(ownerProfile, authenticatedGithubLogin()),
        bridgeAvailable: fs.existsSync(path.join(process.env.USERPROFILE || '', 'Documents', 'TJ_Command_Bridge', 'submit.py'))
      })
    };
  });
  ipcMain.handle('terminal:list', () => terminals.list());
  ipcMain.handle('terminal:create', (_event, input) => terminals.create(input || {}));
  ipcMain.handle('terminal:send', (_event, id, command) => terminals.send(id, command));
  ipcMain.handle('terminal:close', (_event, id) => terminals.close(id));

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
  ipcMain.handle('peer:grok:plugin-status', () => {
    const login = authenticatedGithubLogin();
    const bridge = path.join(process.env.USERPROFILE || '', 'Documents', 'TJ_Command_Bridge', 'submit.py');
    return grokRemoteCliActivationState({
      peerConnected: connectedPeers().some(peer => peer.executiveId === 'grok-ceo'),
      activeCapture: activeCaptureSessions.size > 0,
      ownerVerified: isOwner(ownerProfile, login),
      bridgeAvailable: fs.existsSync(bridge)
    });
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
      consent: request.automatic ? 'OWNER_AUTHORIZED_AUTOMATIC_VISIBLE_CAPTURE' : 'USER_INITIATED_VISIBLE_CAPTURE', status: 'RECORDING', chunks: 0,
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
      experience?.append('agent-run', { agentId, input, output, metric, receiptId: receipt.id }, { surface: 'agent-ui' });
      return { output, receipt, runtimeMetric:metric };
    } catch (error) {
      const metric = { durationMs:Date.now()-startedMs, success:false,
        inputBytes:Buffer.byteLength(JSON.stringify(input || {})), outputBytes:0 };
      const receipt = vault.append('agent-run', agentId, { error:error.message, runtimeMetric:metric });
      supervisor?.recordAgentRun(agentId, receipt, metric, false, error.message);
      const failure = { source:'agent.run', agentId, input, metric, error:String(error.stack || error) };
      experience?.append('agent-failure', failure, { surface: 'agent-ui' });
      residentRuntime?.submitIncident(failure);
      throw error;
    } finally { activeRuns.delete(runId); }
  });
  ipcMain.handle('workflow:route', (_event, request) => {
    const result = routeTask(request, broker, vault);
    supervisor?.recordWorkflow('route', result);
    experience?.append('workflow-route', { request, result }, { surface: 'agent-ui' });
    return result;
  });
  ipcMain.handle('workflow:execute', async (_event, request) => {
    const result = await executeWorkflow(request, broker, vault);
    supervisor?.recordWorkflow('execute', result);
    experience?.append('workflow-execute', { request, result }, { surface: 'agent-ui' });
    return result;
  });
  ipcMain.handle('agent:inbox', (_event, agentId) => inboxFor(agentId, vault));
  ipcMain.handle('agent:process-inbox', (_event, agentId) => processInbox(agentId, vault, broker));
  ipcMain.handle('auth:status', () => localUserStatus());
  ipcMain.handle('auth:register', (_event, request={}) => {
    if(loadLocalUser()) throw new Error('A local user already exists on this device');
    const created=createLocalUser(request); saveLocalUser(created.record); localUserAuthenticated=true;
    vault.append('local-user-created','dt-auth',{username:created.record.username,signInMode:created.record.signInMode});
    return {status:localUserStatus(),recoveryCode:created.recoveryCode};
  });
  ipcMain.handle('auth:login', (_event, request={}) => {
    const record=loadLocalUser(); if(!record||record.username!==String(request.username||'').trim()||!verifyPassword(record,request.password)) throw new Error('Username or password not accepted');
    localUserAuthenticated=true; vault.append('local-user-login','dt-auth',{username:record.username}); return localUserStatus();
  });
  ipcMain.handle('auth:set-mode', (_event, mode) => {
    const record=loadLocalUser(); if(!record||!localUserAuthenticated) throw new Error('Sign in first');
    if(!['EVERY_LAUNCH','TRUST_THIS_DEVICE'].includes(mode)) throw new Error('Invalid sign-in mode');
    record.signInMode=mode; record.updatedAt=new Date().toISOString(); saveLocalUser(record); return localUserStatus();
  });
  ipcMain.handle('auth:recover', (_event, request={}) => {
    const record=loadLocalUser(); if(!record||record.username!==String(request.username||'').trim()||!verifyRecovery(record,request.recoveryCode)) throw new Error('Recovery code not accepted');
    const replacement=createLocalUser({username:record.username,password:request.newPassword,signInMode:'EVERY_LAUNCH'}); replacement.record.id=record.id; replacement.record.createdAt=record.createdAt; saveLocalUser(replacement.record); localUserAuthenticated=true;
    vault.append('local-user-recovered','dt-auth',{username:record.username}); return {status:localUserStatus(),recoveryCode:replacement.recoveryCode};
  });
  ipcMain.handle('session:closeout', (_event, decision) => {
    if(!localUserStatus().authenticated) throw new Error('Sign in required');
    let exported=null; if(decision==='export') exported=automaticRecoveryExport('USER_CLOSEOUT_EXPORT');
    else if(decision==='discard') vault.append('session-closeout-discard','dt-desktop',{scope:'ephemeral-session-only',persistentAuditPreserved:true});
    else throw new Error('Closeout decision must be export or discard');
    clearSessionDirty(dataRoot()); cleanCloseout=true; setTimeout(()=>app.quit(),80); return {decision,exported};
  });
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
  ipcMain.handle('provider:list', () => Object.entries(PROVIDERS).map(([id, item]) => {
    const hasCredential = fs.existsSync(credentialFile(id));
    const proof = id === 'xai' ? adapters.load('xai-provider') : null;
    const verifiedReachable = proof?.outcomeVerified === true || proof?.status === 'PONG_RECEIVED';
    return {
      id, label: item.label, keyRequired: item.keyRequired, hasCredential,
      implementationComplete: true,
      connectivity: id === 'xai' ? (verifiedReachable ? 'VERIFIED_REACHABLE' : 'UNVERIFIED') : (!item.keyRequired ? 'LOCAL_READY' : 'UNVERIFIED'),
      connected: id === 'xai' ? verifiedReachable : (!item.keyRequired || hasCredential)
    };
  }));
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

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const localWindow = webContents.getURL().startsWith('file:');
    callback(localWindow && (permission === 'display-capture' || permission === 'media'));
  });
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
    callback(sources[0] ? { video: sources[0] } : {});
  }, { useSystemPicker: false });
  const root = dataRoot();
  vault = new Vault(root);
  if (!utilityMode) {
    const priorDirty = readDirtySession(root);
    if (priorDirty) {
      try {
        const recovered = automaticRecoveryExport('PREVIOUS_UNCLEAN_SESSION_DETECTED_ON_STARTUP');
        vault.append('unclean-session-recovery-export', 'dt-desktop', { priorSession: priorDirty, recovery: recovered });
        clearSessionDirty(root);
      } catch (error) {
        vault.append('unclean-session-recovery-failed', 'dt-desktop', { priorSession: priorDirty, error: String(error.message || error) });
      }
    }
    markSessionDirty(root, { pid: process.pid, version: app.getVersion(), priorUncleanDetected: !!priorDirty, priorSession: priorDirty || null });
  }
  keys = new KeyAuthority(path.join(root, 'authority'));
  recovery = new RecoveryAuthority(path.join(root, 'authority'), keys, ownerProfile.githubLogin);
  adapters = new AdapterStatusRegistry(root);
  seedRecoveredAdapterEvidence();
  bootstrapState = new DTBootstrap(root).run();
  experience = new ExperienceLedger(root);
  residentRuntime = new ResidentRuntime({ root, vault, experience, maxWorkers: 3 });
  if (!utilityMode) residentRuntime.start();
  capabilityBus = new CapabilityBus({ vault });
  registerCoreCapabilities(capabilityBus, {
    environment: bootstrapState.environment, runHeadlessCommand, experience, residentRuntime,
    extraRoots: ['C:\DT'].filter(value => fs.existsSync(value))
  });
  skillRegistry = new LearnedSkillRegistry(root);
  localIntelligence = new DTLocalIntelligence();
  promptRuntime = new PromptRuntime({ skillRegistry, capabilityBus, localIntelligence, executeSkill, vault });
  terminals = new TerminalRuntime({
    auditRoot: path.join(app.getPath('userData'), 'command-center'), vault, experience, residentRuntime,
    emit: (channel, data) => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, data); }
  });
  const registry = new AgentRegistry(agents);
  broker = new Broker(vault, registry);
  gateway = createGateway({ keys, vault, broker, agents: registry });
  gateway.start();
  supervisor = new EmbeddedSupervisor({ app, vault, agents });
  if (!utilityMode) supervisor.start();
  registerIPC(registry);
  if (process.argv.includes('--grok-provider-ping')) {
    const nonce='GROK-PING-20260916T2226EDT-COFFEEMAKER3737';
    const syncRoot='C:\\DT\\GoogleDrive\\My Drive\\GROK_DT_SYNC';
    const credentialProvider=fs.existsSync(credentialFile('xai'))?'xai':'compatible';
    const model='grok-4';
    let responseText=null,httpStatus=null,errorClass=null,errorMessage=null;
    try {
      const apiKey=readCredential(credentialProvider);
      const definition=providerDefinition('xai');
      const prepared=buildRequest(definition,{apiKey,model,system:'Return exactly PONG and nothing else.',messages:[{role:'user',content:nonce}]});
      const response=await fetch(prepared.url,{method:'POST',headers:prepared.headers,body:JSON.stringify(prepared.body),signal:AbortSignal.timeout(120000)});
      httpStatus=response.status; const raw=await response.text(); let data={}; try{data=JSON.parse(raw)}catch{}
      if(response.ok) responseText=String(data.choices?.[0]?.message?.content||'').trim();
      else { const e=data.error||{}; errorClass=String(e.type||e.code||'other'); errorMessage=String(e.message||raw||('HTTP '+response.status)).slice(0,1000); }
    } catch(err){ errorClass='client_error'; errorMessage=err.message||String(err); }
    const status=responseText==='PONG'?'PONG_RECEIVED':'NOT_CONNECTED';
    const body=['# COFFEEMAKER PROVIDER PING RETRY RECEIPT','', '- Source: GPT-desktop-root','- Device: CoffeeMaker3737','- Provider adapter: xai via DT Desktop Suite',`- Model sent: ${model}`,`- Nonce: ${nonce}`,`- HTTP status: ${httpStatus??'(none)'}`,`- Provider error class: ${errorClass||'(none)'}`,`- Provider error message: ${errorMessage||'(none)'}`,`- Response: ${responseText||'(none)'}`,`- Status: ${status}`,'- Credential material included: false','- Canonical claimed: false','- HVAC: PARKED',`- Created: ${new Date().toISOString()}`].join('\n');
    const receiptPath=path.join(syncRoot,'20260917T_CORRECTED__GROK_SYNC__COFFEEMAKER_PROVIDER_PING__RECEIPT.md');
    fs.writeFileSync(receiptPath,body,'utf8');
    adapters.record('xai-provider',{adapter:'xai',implementationComplete:true,status,httpStatus,outcomeVerified:status==='PONG_RECEIVED',evidencePath:receiptPath});
    console.log(JSON.stringify({receiptPath,status,httpStatus,errorClass,errorMessage,response:responseText,model},null,2)); app.quit(); return;
  }
  createTray();
  createWindow(pendingAgentSelection, pendingShellView);
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on('before-quit', () => {
  if (!cleanCloseout) {
    let exported = false;
    try { automaticRecoveryExport('UNCLEAN_OR_EXTERNAL_QUIT'); exported = true; }
    catch (error) { try { fs.writeFileSync(path.join(dataRoot(),'last-unclean-export-error.txt'),String(error.stack||error),'utf8'); } catch {} }
    if (exported) clearSessionDirty(dataRoot());
  } else clearSessionDirty(dataRoot());
  isQuitting = true;
  terminals?.closeAll();
  residentRuntime?.stop();
  supervisor?.stop();
  gateway?.stop();
  try { tray?.destroy(); } catch {}
});

app.on('window-all-closed', () => {
  // The DT kernel remains resident. Reopen through the tray or launch DT again.
});
