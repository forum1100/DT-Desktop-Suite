const test = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyTransport,
  createGrokProposal,
  evaluateProposal,
  createReceipt
} = require('../packages/core/src/peer-mailbox.cjs');

test('GitHub is temporary transport and is not the DT gateway', () => {
  assert.equal(classifyTransport('github'), 'TEMPORARY_TRANSPORT_NOT_GATEWAY');
  assert.equal(classifyTransport('mcp'), 'ADAPTER_NOT_GATEWAY');
  assert.equal(classifyTransport('tcp_listener'), 'PROHIBITED');
});

test('missing captureSessionId is a hard refuse', () => {
  const proposal = createGrokProposal({
    executiveId: 'grok-ceo',
    provider: 'xai',
    sessionId: 'grok-ceo',
    capability: 'mailbox.ping',
    payload: { intent: 'negative capture test' }
  });
  const result = evaluateProposal(proposal, {
    activeCaptureSessionIds: [],
    prismAuthorized: true,
    dtAuthenticated: true
  });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'MISSING_OR_INVALID_CAPTURE_SESSION_ID');
  assert.equal(result.connectionStatus, 'NOT_CONNECTED');
});

test('inactive captureSessionId is a hard refuse', () => {
  const proposal = createGrokProposal({
    executiveId: 'grok-ceo',
    provider: 'xai',
    sessionId: 'grok-ceo',
    captureSessionId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    capability: 'mailbox.ping'
  });
  const result = evaluateProposal(proposal, {
    activeCaptureSessionIds: ['11111111-1111-4111-8111-111111111111'],
    prismAuthorized: true,
    dtAuthenticated: true
  });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'CAPTURE_SESSION_NOT_ACTIVE');
});

test('mouse capability cannot ride peer connection', () => {
  assert.throws(() => createGrokProposal({
    executiveId: 'grok-ceo',
    provider: 'xai',
    sessionId: 'grok-ceo',
    captureSessionId: '11111111-1111-4111-8111-111111111111',
    capability: 'desktop.mouse'
  }), /Mouse authority/);
});

test('receipt of a refused proposal remains NOT_CONNECTED and unexecuted', () => {
  const proposal = createGrokProposal({
    executiveId: 'grok-ceo',
    provider: 'xai',
    sessionId: 'grok-ceo',
    capability: 'command.propose',
    payload: { command: 'echo GROK_CEO_PING' }
  });
  const evaluation = evaluateProposal(proposal, {});
  const receipt = createReceipt(proposal, evaluation);
  assert.equal(receipt.executed, false);
  assert.equal(receipt.connectionStatus, 'NOT_CONNECTED');
  assert.equal(receipt.gatewayAuthority, 'DT_PLATFORM');
});
