const { evaluateProposal } = require('./peer-mailbox.cjs');
const { createPeerEnvelope } = require('./peer-edge.cjs');

const HANDSHAKE_COMMAND = 'echo GROK_CEO_PING';

function prismHandshakeDecision(proposal) {
  if (!proposal || proposal.capability !== 'command.propose') {
    return { allowed: false, code: 'PRISM_REJECTED', reason: 'HANDSHAKE_CAPABILITY_REQUIRED' };
  }
  const payload = proposal.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { allowed: false, code: 'PRISM_REJECTED', reason: 'HANDSHAKE_PAYLOAD_REQUIRED' };
  }
  const keys = Object.keys(payload).sort();
  if (keys.length !== 1 || keys[0] !== 'command') {
    return { allowed: false, code: 'PRISM_REJECTED', reason: 'HANDSHAKE_PAYLOAD_MUST_BE_COMMAND_ONLY' };
  }
  if (String(payload.command || '').trim() !== HANDSHAKE_COMMAND) {
    return { allowed: false, code: 'PRISM_REJECTED', reason: 'HANDSHAKE_COMMAND_NOT_ALLOWLISTED' };
  }
  return { allowed: true, code: 'PRISM_PASS', reason: 'BOUNDED_GROK_HANDSHAKE_ONLY' };
}
function proposalWasConsumed(vaultRows = [], proposalHash) {
  if (!proposalHash) return false;
  return vaultRows.some(row => row && row.kind === 'grok-peer-handshake-consumed' &&
    row.data && row.data.proposalHash === proposalHash);
}

function prepareGrokHandshake(proposal, context = {}) {
  const prism = prismHandshakeDecision(proposal);
  if (context.ownerApproved !== true) {
    return { accepted: false, reason: 'OWNER_SINGLE_USE_APPROVAL_REQUIRED', executed: false, connectionStatus: 'NOT_CONNECTED', prism };
  }
  const evaluation = evaluateProposal(proposal, {
    activeCaptureSessionIds: context.activeCaptureSessionIds || [],
    prismAuthorized: prism.allowed,
    dtAuthenticated: context.dtAuthenticated === true
  });
  if (!evaluation.accepted) return { ...evaluation, prism };
  const envelope = createPeerEnvelope({
    executiveId: proposal.executiveId,
    provider: proposal.provider,
    sessionId: proposal.sessionId,
    captureSessionId: proposal.captureSessionId,
    capability: proposal.capability,
    payload: proposal.payload,
    expiresAt: new Date(Date.now() + 60000).toISOString()
  });
  return { accepted: true, reason: 'AUTHORIZED_FOR_SINGLE_HANDSHAKE_EXECUTION', executed: false,
    connectionStatus: 'NOT_CONNECTED', prism, envelope };
}

module.exports = { HANDSHAKE_COMMAND, prismHandshakeDecision, proposalWasConsumed, prepareGrokHandshake };
