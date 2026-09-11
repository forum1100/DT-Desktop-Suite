const path = require('node:path');
const { evaluateProposal } = require('./peer-mailbox.cjs');
const { createPeerEnvelope } = require('./peer-edge.cjs');

const COMMAND_CAPABILITY = 'command.execute';
const MAX_COMMAND_LENGTH = 4096;
const DEFAULT_TIMEOUT_SECONDS = 120;
const MAX_TIMEOUT_SECONDS = 900;

const HARD_BLOCK_PATTERNS = [
  /\bformat\b/i, /\bdiskpart\b/i, /\bcipher\s+\/w\b/i,
  /\bshutdown\b/i, /\brestart-computer\b/i, /\bstop-computer\b/i,
  /\bnet\s+user\b/i, /\bnet\s+localgroup\b/i, /\bsc(?:\.exe)?\s+(?:create|delete|config)\b/i,
  /\breg(?:\.exe)?\s+(?:add|delete)\b/i, /\btakeown\b/i, /\bicacls\b.*\/(?:grant|deny|reset)/i,
  /\bremove-item\b.*-recurse/i, /\brmdir\b.*\/(?:s|q)/i, /\bdel\b.*\/(?:s|q)/i,
  /\bgit\s+reset\s+--hard\b/i, /\bgit\s+clean\s+-[a-z]*f/i, /\bgit\s+push\b.*--force/i,
  /\btaskkill\b/i, /\bstop-process\b/i, /\bkill-process\b/i,
  /\bpowershell(?:\.exe)?\b.*-enc(?:odedcommand)?\b/i
];

const SAFE_COMMAND_PATTERNS = [
  /^echo\b/i, /^cd\s*$/i, /^pwd\s*$/i, /^(?:dir|ls)\b/i,
  /^(?:type|cat|get-content)\b/i,
  /^git\s+(?:status|diff|log|show|rev-parse|branch\s+--show-current)\b/i,
  /^(?:node|python|py)\s+--version\b/i, /^npm(?:\.cmd)?\s+--version\b/i,
  /^node\s+--test\b/i, /^(?:python|py)\s+-m\s+pytest\b/i,
  /^npm(?:\.cmd)?\s+(?:test|run\s+(?:test|build|lint|check|typecheck))\b/i
];function commandRisk(command) {
  const text = String(command || '').trim();
  if (!text) return { level: 'BLOCKED', reason: 'EMPTY_COMMAND' };
  if (text.length > MAX_COMMAND_LENGTH) return { level: 'BLOCKED', reason: 'COMMAND_TOO_LONG' };
  if (HARD_BLOCK_PATTERNS.some(pattern => pattern.test(text))) {
    return { level: 'BLOCKED', reason: 'DESTRUCTIVE_OR_PRIVILEGE_CHANGING_COMMAND' };
  }
  if (/[;&|><`]/.test(text)) {
    return { level: 'OWNER_APPROVAL_REQUIRED', reason: 'SHELL_COMPOSITION_REQUIRES_OWNER_APPROVAL' };
  }
  if (SAFE_COMMAND_PATTERNS.some(pattern => pattern.test(text))) {
    return { level: 'SAFE_AUTOMATIC', reason: 'READ_BUILD_TEST_ALLOWLIST' };
  }
  return { level: 'OWNER_APPROVAL_REQUIRED', reason: 'COMMAND_OUTSIDE_SAFE_ALLOWLIST' };
}

function normalizePayload(proposal = {}, context = {}) {
  const payload = proposal.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Command payload required');
  const allowedKeys = new Set(['command', 'cwd', 'timeoutSeconds']);
  for (const key of Object.keys(payload)) if (!allowedKeys.has(key)) throw new Error('Unsupported command payload field');
  const command = String(payload.command || '').trim();
  const timeoutSeconds = Math.max(1, Math.min(MAX_TIMEOUT_SECONDS,
    Number.isFinite(Number(payload.timeoutSeconds)) ? Math.floor(Number(payload.timeoutSeconds)) : DEFAULT_TIMEOUT_SECONDS));
  const requestedCwd = String(payload.cwd || context.defaultCwd || '').trim();
  const cwd = path.resolve(requestedCwd || context.defaultCwd || process.cwd());
  const roots = (context.allowedRoots || []).map(root => path.resolve(root));
  if (roots.length && !roots.some(root => cwd === root || cwd.startsWith(root + path.sep))) {
    throw new Error('Command cwd is outside DT-authorized roots');
  }
  return { command, cwd, timeoutSeconds };
}function prismCommandDecision(proposal, context = {}) {
  if (!proposal || proposal.capability !== COMMAND_CAPABILITY) {
    return { allowed: false, approvalRequired: false, code: 'PRISM_REJECTED', reason: 'COMMAND_CAPABILITY_REQUIRED' };
  }
  let normalized;
  try { normalized = normalizePayload(proposal, context); }
  catch (error) {
    return { allowed: false, approvalRequired: false, code: 'PRISM_REJECTED', reason: error.message };
  }
  const risk = commandRisk(normalized.command);
  if (risk.level === 'BLOCKED') {
    return { allowed: false, approvalRequired: false, code: 'PRISM_BLOCKED', reason: risk.reason, risk, normalized };
  }
  return {
    allowed: true,
    approvalRequired: risk.level === 'OWNER_APPROVAL_REQUIRED',
    code: risk.level === 'SAFE_AUTOMATIC' ? 'PRISM_SAFE_COMMAND' : 'PRISM_OWNER_APPROVAL_REQUIRED',
    reason: risk.reason, risk, normalized
  };
}

function commandProposalWasConsumed(vaultRows = [], proposalHash) {
  if (!proposalHash) return false;
  return vaultRows.some(row => row && row.kind === 'grok-peer-command-consumed' &&
    row.data && row.data.proposalHash === proposalHash);
}

function prepareGrokCommand(proposal, context = {}) {
  const prism = prismCommandDecision(proposal, context);
  if (!prism.allowed) {
    return { accepted: false, executed: false, connectionStatus: 'CONNECTED', reason: prism.reason, prism };
  }
  if (prism.approvalRequired && context.ownerApproved !== true) {
    return { accepted: false, executed: false, connectionStatus: 'CONNECTED',
      reason: 'OWNER_SINGLE_USE_APPROVAL_REQUIRED', prism };
  }
  const evaluation = evaluateProposal(proposal, {
    activeCaptureSessionIds: context.activeCaptureSessionIds || [],
    prismAuthorized: true,
    dtAuthenticated: context.dtAuthenticated === true
  });
  if (!evaluation.accepted) return { ...evaluation, connectionStatus: 'CONNECTED', prism };
  const envelope = createPeerEnvelope({
    executiveId: proposal.executiveId,
    provider: proposal.provider,
    sessionId: proposal.sessionId,
    captureSessionId: proposal.captureSessionId,
    capability: COMMAND_CAPABILITY,
    payload: prism.normalized,
    expiresAt: new Date(Date.now() + 60000).toISOString()
  });
  return { accepted: true, executed: false, connectionStatus: 'CONNECTED',
    reason: prism.approvalRequired ? 'OWNER_AUTHORIZED_COMMAND' : 'SAFE_COMMAND_AUTHORIZED', prism, envelope };
}module.exports = {
  COMMAND_CAPABILITY,
  DEFAULT_TIMEOUT_SECONDS,
  MAX_TIMEOUT_SECONDS,
  commandRisk,
  normalizePayload,
  prismCommandDecision,
  commandProposalWasConsumed,
  prepareGrokCommand
};
function createCommandReceipt(proposal, prepared, extras = {}) {
  const body = {
    schema: 'dt-peer-command-receipt/1.0',
    gatewayAuthority: 'DT_PLATFORM',
    executiveId: 'grok-ceo', provider: 'xai', sessionId: 'grok-ceo',
    captureSessionId: proposal?.captureSessionId || null,
    proposalHash: proposal?.proposalHash || null,
    capability: COMMAND_CAPABILITY,
    accepted: Boolean(prepared?.accepted), reason: prepared?.reason || 'UNKNOWN',
    riskLevel: prepared?.prism?.risk?.level || null,
    ownerApprovalRequired: prepared?.prism?.approvalRequired === true,
    ownerApproved: extras.ownerApproved === true,
    executed: extras.executed === true,
    officialRequestId: extras.officialRequestId || null,
    officialRequestHash: extras.officialRequestHash || null,
    bridgeRequestId: extras.bridgeRequestId || null,
    exitCode: Number.isInteger(extras.exitCode) ? extras.exitCode : null,
    stdout: typeof extras.stdout === 'string' ? extras.stdout : '',
    stderr: typeof extras.stderr === 'string' ? extras.stderr : '',
    resultHash: extras.resultHash || null,
    outcomeObserved: extras.executed === true && Number.isInteger(extras.exitCode),
    connectionStatus: 'CONNECTED', createdAt: new Date().toISOString()
  };
  const { stableHash } = require('./peer-mailbox.cjs');
  return Object.freeze({ ...body, receiptHash: stableHash(body) });
}
module.exports.createCommandReceipt = createCommandReceipt;