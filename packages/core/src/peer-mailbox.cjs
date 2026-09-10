const crypto = require('node:crypto');
const { getPeerExecutive } = require('../../auth/src/peers.cjs');

const TRANSPORT_CLASS = Object.freeze({
  github: 'TEMPORARY_TRANSPORT_NOT_GATEWAY',
  drive: 'TEMPORARY_TRANSPORT_NOT_GATEWAY',
  local_fs: 'DT_INTERNAL_TRANSPORT',
  tcp_listener: 'PROHIBITED',
  xai: 'PROVIDER_EDGE_NOT_GATEWAY',
  openai: 'PROVIDER_EDGE_NOT_GATEWAY',
  mcp: 'ADAPTER_NOT_GATEWAY'
});

const ALLOWED_GROK_CAPABILITIES = Object.freeze([
  'command.propose',
  'mailbox.ping',
  'mailbox.read-receipt'
]);

const MOUSE_CAPABILITIES = Object.freeze([
  'desktop.mouse',
  'control.move',
  'control.click',
  'control.scroll',
  'control.execute'
]);

function classifyTransport(name) {
  const key = String(name || '').toLowerCase();
  return TRANSPORT_CLASS[key] || 'UNKNOWN_TRANSPORT_NOT_GATEWAY';
}

function validCaptureId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function createGrokProposal(input = {}) {
  const peer = getPeerExecutive(input.executiveId || 'grok-ceo');
  if (!peer || peer.id !== 'grok-ceo') throw new Error('Proposal must use grok-ceo');
  if (String(input.provider || '') !== 'xai') throw new Error('Provider must be xai');
  if (String(input.sessionId || '') !== 'grok-ceo') throw new Error('Session lane must be grok-ceo');
  const capability = String(input.capability || '').trim();
  if (!capability) throw new Error('Bounded capability required');
  if (MOUSE_CAPABILITIES.includes(capability)) {
    throw new Error('Mouse authority is not granted by peer connection');
  }
  if (!ALLOWED_GROK_CAPABILITIES.includes(capability)) {
    throw new Error('Capability is not in the grok-ceo allowlist');
  }
  const captureSessionId = input.captureSessionId;
  const body = {
    schema: 'dt-peer-mailbox-proposal/1.0',
    transport: 'github',
    transportClass: classifyTransport('github'),
    gatewayAuthority: 'DT_PLATFORM',
    executiveId: 'grok-ceo',
    provider: 'xai',
    standing: 'PEER_EXECUTIVE',
    sessionId: 'grok-ceo',
    captureSessionId: captureSessionId || null,
    capability,
    payload: input.payload ?? null,
    proposedAt: new Date().toISOString(),
    status: 'PROPOSED_NOT_AUTHORIZED',
    notes: [
      'GitHub is a temporary mailbox transport only.',
      'DT Platform remains the gateway.',
      'DT must mint requestId and requestHash after live gates pass.',
      'This proposal is not execution authority.'
    ]
  };
  return Object.freeze({ ...body, proposalHash: stableHash(body) });
}

function evaluateProposal(proposal, context = {}) {
  if (!proposal || proposal.schema !== 'dt-peer-mailbox-proposal/1.0') {
    return refuse('INVALID_PROPOSAL_SCHEMA');
  }
  if (proposal.transportClass !== 'TEMPORARY_TRANSPORT_NOT_GATEWAY') {
    return refuse('TRANSPORT_MISCLASSIFIED_AS_GATEWAY');
  }
  if (proposal.gatewayAuthority !== 'DT_PLATFORM') {
    return refuse('GATEWAY_MUST_REMAIN_DT_PLATFORM');
  }
  if (proposal.executiveId !== 'grok-ceo' || proposal.provider !== 'xai' || proposal.sessionId !== 'grok-ceo') {
    return refuse('PEER_IDENTITY_MISMATCH');
  }
  if (MOUSE_CAPABILITIES.includes(proposal.capability)) {
    return refuse('MOUSE_AUTHORITY_NOT_GRANTED_BY_CONNECTION');
  }
  if (!ALLOWED_GROK_CAPABILITIES.includes(proposal.capability)) {
    return refuse('CAPABILITY_NOT_ALLOWLISTED');
  }
  if (!validCaptureId(proposal.captureSessionId)) {
    return refuse('MISSING_OR_INVALID_CAPTURE_SESSION_ID');
  }
  const active = new Set(context.activeCaptureSessionIds || []);
  if (!active.has(proposal.captureSessionId)) {
    return refuse('CAPTURE_SESSION_NOT_ACTIVE');
  }
  if (context.prismAuthorized !== true) {
    return refuse('PRISM_AUTHORIZATION_REQUIRED');
  }
  if (context.dtAuthenticated !== true) {
    return refuse('DT_PEER_AUTHENTICATION_REQUIRED');
  }
  return Object.freeze({
    accepted: true,
    reason: 'GATES_PRESENT_NOT_EXECUTED',
    next: 'DT_MUST_CREATE_OFFICIAL_dt-peer-edge/1.0_ENVELOPE_AND_EXECUTE_LOCALLY',
    captureSessionId: proposal.captureSessionId,
    proposalHash: proposal.proposalHash
  });
}

function refuse(reason) {
  return Object.freeze({
    accepted: false,
    reason,
    executed: false,
    connectionStatus: 'NOT_CONNECTED'
  });
}

function createReceipt(proposal, evaluation, extras = {}) {
  const body = {
    schema: 'dt-peer-mailbox-receipt/1.0',
    gatewayAuthority: 'DT_PLATFORM',
    transportClass: classifyTransport(extras.transport || 'github'),
    executiveId: 'grok-ceo',
    provider: 'xai',
    sessionId: 'grok-ceo',
    captureSessionId: proposal?.captureSessionId || null,
    proposalHash: proposal?.proposalHash || null,
    accepted: Boolean(evaluation?.accepted),
    reason: evaluation?.reason || 'UNKNOWN',
    executed: Boolean(extras.executed),
    connectionStatus: extras.executed ? 'LIVE_PROOF_PENDING_RESULT_RETURN' : 'NOT_CONNECTED',
    createdAt: new Date().toISOString()
  };
  return Object.freeze({ ...body, receiptHash: stableHash(body) });
}

module.exports = {
  TRANSPORT_CLASS,
  ALLOWED_GROK_CAPABILITIES,
  MOUSE_CAPABILITIES,
  classifyTransport,
  createGrokProposal,
  evaluateProposal,
  createReceipt,
  validCaptureId,
  stableHash
};
