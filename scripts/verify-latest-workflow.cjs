const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Vault } = require('../packages/core/src/vault.cjs');
const { createBundle, verifyBundle, verifyEntries } = require('../packages/core/src/portable.cjs');

const appRoot = path.join(process.env.APPDATA, 'dt-desktop-suite', 'dt-vault');
const captureRoot = path.join(appRoot, 'screen-captures');
const sessions = fs.readdirSync(captureRoot)
  .map(name => ({ name, root: path.join(captureRoot, name) }))
  .filter(item => fs.statSync(item.root).isDirectory())
  .sort((a, b) => fs.statSync(b.root).mtimeMs - fs.statSync(a.root).mtimeMs);
if (!sessions.length) throw new Error('No capture sessions found');

const latest = sessions[0];
const manifest = JSON.parse(fs.readFileSync(path.join(latest.root, 'manifest.json'), 'utf8'));
if (manifest.status !== 'COMPLETED') throw new Error('Latest capture is not completed');
const videoPath = path.join(latest.root, 'screen.webm');
const video = fs.readFileSync(videoPath);
const videoSha256 = crypto.createHash('sha256').update(video).digest('hex');
const videoHashMatch = videoSha256 === manifest.videoSha256;
const eventPath = path.join(latest.root, 'control-events.jsonl');
const events = fs.existsSync(eventPath)
  ? fs.readFileSync(eventPath, 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse) : [];
const execution = events.find(row => row.result === 'EXECUTED_NOT_OUTCOME_VERIFIED');
const observation = events.find(row => row.type === 'SAFE_TEST_RESULT');
const workflowPass = Boolean(videoHashMatch && execution && observation?.status === 'PASS');

const vault = new Vault(appRoot);
const chainBefore = verifyEntries(vault.all());
if (!chainBefore.valid) throw new Error('Live vault invalid: ' + chainBefore.reason);
const exportRoot = path.join(os.homedir(), 'Desktop', 'DT Works Suite Transfer', 'Workflow Verification');
fs.mkdirSync(exportRoot, { recursive: true });
const bundle = createBundle(vault.all(), {
  purpose: 'FULL_TASK_BOUND_WORKFLOW_VERIFICATION',
  sourceSessionId: manifest.sessionId
});
const bundlePath = path.join(exportRoot, 'DT Vault Verification ' + manifest.sessionId + '.json');
fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), 'utf8');
const readback = verifyBundle(JSON.parse(fs.readFileSync(bundlePath, 'utf8')));
const receipt = vault.append('full-workflow-verified', 'validation-manager', {
  sourceSessionId: manifest.sessionId,
  task: manifest.task,
  captureStatus: manifest.status,
  videoBytes: video.length,
  videoSha256,
  videoHashMatch,
  execution,
  observation,
  workflowPass,
  exportedBundle: path.basename(bundlePath),
  bundleHash: readback.bundleHash,
  bundleRecordCount: readback.recordCount,
  readbackValid: readback.valid
});
const report = {
  workflowPass,
  sessionId: manifest.sessionId,
  videoHashMatch,
  execution,
  observation,
  vaultChainBeforeExport: chainBefore,
  portableReadback: readback,
  bundlePath,
  validationReceipt: { id: receipt.id, hash: receipt.hash }
};
console.log(JSON.stringify(report, null, 2));
if (!workflowPass || !readback.valid) process.exitCode = 1;
