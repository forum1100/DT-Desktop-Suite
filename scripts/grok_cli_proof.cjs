const { app, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { providerDefinition, buildRequest } = require('../packages/providers/src/index.cjs');
const { createGrokProposal, stableHash } = require('../packages/core/src/peer-mailbox.cjs');
const { prepareGrokCommand } = require('../packages/core/src/grok-command.cjs');

const NONCE = 'GROK-CLI-PROOF-20260917T140918EDT-COFFEEMAKER3737';
const CAPTURE = 'db1f359d-bc3f-4046-82d3-75fc03ce42f4';
const SYNC = 'C:\\DT\\GoogleDrive\\My Drive\\GROK_DT_SYNC';
const USERDATA = path.join(process.env.APPDATA, 'dt-desktop-suite');
app.setPath('userData', USERDATA);

function sha(v) { return crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex'); }
function credentialFile() { return path.join(USERDATA, 'dt-vault', 'credentials', 'xai.bin'); }
function readKey() { if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption unavailable'); return safeStorage.decryptString(fs.readFileSync(credentialFile())); }

app.whenReady().then(async () => {
  const command = `echo ${NONCE}`;
  const def = providerDefinition('xai');
  const preparedReq = buildRequest(def, { apiKey: readKey(), model: 'grok-4', system: `Return exactly this command and nothing else: ${command}`, messages: [{ role: 'user', content: `Issue the bounded harmless DT CLI proof command for nonce ${NONCE}.` }] });
  const res = await fetch(preparedReq.url, { method: 'POST', headers: preparedReq.headers, body: JSON.stringify(preparedReq.body), signal: AbortSignal.timeout(120000) });
  const raw = await res.text(); let data = {}; try { data = JSON.parse(raw); } catch {}
  const providerText = String(data.choices?.[0]?.message?.content || '').trim();
  if (!res.ok || providerText !== command) throw new Error(`Provider proof request failed: HTTP ${res.status}, response=${providerText || raw}`);

  const proposal = createGrokProposal({ executiveId: 'grok-ceo', provider: 'xai', sessionId: 'grok-ceo', captureSessionId: CAPTURE, capability: 'command.execute', payload: { command, cwd: process.env.USERPROFILE, timeoutSeconds: 30 } });
  const authorized = prepareGrokCommand(proposal, { ownerApproved: false, dtAuthenticated: true, activeCaptureSessionIds: [CAPTURE], allowedRoots: [process.env.USERPROFILE], defaultCwd: process.env.USERPROFILE });
  if (!authorized.accepted || authorized.prism?.risk?.level !== 'SAFE_AUTOMATIC') throw new Error(`DT rejected proof: ${authorized.reason}`);

  const bridgeRoot = path.join(process.env.USERPROFILE, 'Documents', 'TJ_Command_Bridge');
  const submit = path.join(bridgeRoot, 'submit.py');
  const proc = spawnSync('py', ['-3', submit, '--session', 'grok-ceo-proof', '--cwd', process.env.USERPROFILE, '--timeout', '30', '--', command], { encoding: 'utf8', windowsHide: true, timeout: 45000, maxBuffer: 1024 * 1024 });
  const lines = String(proc.stdout || '').trim().split(/\r?\n/); const bridgeRequestId = lines.shift()?.trim() || null;
  let result = null; try { result = JSON.parse(lines.join('\n')); } catch {}
  if (!result) throw new Error(`Bridge result parse failure: ${proc.stderr || proc.stdout}`);
  const stdout = String(result.stdout || '').trim();
  const passed = result.exit_code === 0 && stdout === NONCE;
  const resultHash = sha(result);
  const proof = { schema: 'dt-grok-remote-cli-proof/1.0', pluginId: 'grok-remote-cli', pluginVersion: '1.0.0', provider: 'xai', providerModel: 'grok-4', providerHttpStatus: res.status, providerResponse: providerText, providerResponseHash: sha(providerText), nonce: NONCE, captureSessionId: CAPTURE, capability: 'command.execute', command, riskLevel: authorized.prism.risk.level, ownerApprovalRequired: authorized.prism.approvalRequired, standingLease: false, peerConnectedClaimed: false, officialRequestId: authorized.envelope.requestId, officialRequestHash: authorized.envelope.requestHash, proposalHash: proposal.proposalHash, bridgeRequestId, exitCode: result.exit_code, stdout, stderr: String(result.stderr || ''), resultHash, outcomeVerified: passed, credentialMaterialIncluded: false, createdAt: new Date().toISOString() };
  proof.proofHash = stableHash(proof);
  fs.mkdirSync(SYNC, { recursive: true });
  const requestPath = path.join(SYNC, '20260917T140918EDT__GROK_SYNC__REMOTE_CLI_PROOF__REQUEST.json');
  const receiptPath = path.join(SYNC, '20260917T140918EDT__GROK_SYNC__REMOTE_CLI_PROOF__RESULT.json');
  fs.writeFileSync(requestPath, JSON.stringify({ schema: 'dt-grok-remote-cli-proof-request/1.0', nonce: NONCE, provider: 'xai', providerResponse: providerText, providerResponseHash: sha(providerText), proposal, credentialMaterialIncluded: false }, null, 2));
  fs.writeFileSync(receiptPath, JSON.stringify(proof, null, 2));
  console.log(JSON.stringify({ requestPath, receiptPath, passed, proofHash: proof.proofHash, resultHash, bridgeRequestId, providerHttpStatus: res.status }, null, 2));
  app.quit();
}).catch(err => { console.error(err.stack || err.message || String(err)); app.exit(1); });
