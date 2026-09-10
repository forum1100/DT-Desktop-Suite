const test = require('node:test');
const assert = require('node:assert/strict');
const { createGrokProposal } = require('../packages/core/src/peer-mailbox.cjs');
const { HANDSHAKE_COMMAND, prepareGrokHandshake, prismHandshakeDecision } = require('../packages/core/src/grok-handshake.cjs');

const captureSessionId = '11111111-1111-4111-8111-111111111111';

function proposal(command = HANDSHAKE_COMMAND) {
  return createGrokProposal({
    executiveId: 'grok-ceo', provider: 'xai', sessionId: 'grok-ceo',
    captureSessionId, capability: 'command.propose', payload: { command }
  });
}

test('handshake Prism permits only the exact bounded ping', () => {
  assert.equal(prismHandshakeDecision(proposal()).allowed, true);
  const denied = prismHandshakeDecision(proposal('whoami'));
  assert.equal(denied.allowed, false);
  assert.equal(denied.reason, 'HANDSHAKE_COMMAND_NOT_ALLOWLISTED');
});

test('live handshake needs owner approval, DT auth, and active capture', () => {
  assert.equal(prepareGrokHandshake(proposal(), {}).reason, 'OWNER_SINGLE_USE_APPROVAL_REQUIRED');
  const inactive = prepareGrokHandshake(proposal(), { ownerApproved: true, dtAuthenticated: true, activeCaptureSessionIds: [] });
  assert.equal(inactive.reason, 'CAPTURE_SESSION_NOT_ACTIVE');
  const unauth = prepareGrokHandshake(proposal(), {
    ownerApproved: true, dtAuthenticated: false, activeCaptureSessionIds: [captureSessionId]
  });
  assert.equal(unauth.reason, 'DT_PEER_AUTHENTICATION_REQUIRED');
  const allowed = prepareGrokHandshake(proposal(), {
    ownerApproved: true, dtAuthenticated: true, activeCaptureSessionIds: [captureSessionId]
  });
  assert.equal(allowed.accepted, true);
  assert.equal(allowed.envelope.executiveId, 'grok-ceo');
  assert.equal(allowed.envelope.captureSessionId, captureSessionId);
  assert.equal(allowed.envelope.payload.command, HANDSHAKE_COMMAND);
  assert.equal(allowed.connectionStatus, 'NOT_CONNECTED');
});
