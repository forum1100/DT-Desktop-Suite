const test = require('node:test');
const assert = require('node:assert/strict');
const { createPeerEnvelope, verifyPeerEnvelope } = require('../packages/core/src/peer-edge.cjs');
const { listPeerExecutives } = require('../packages/auth/src/peers.cjs');

const captureSessionId = '11111111-1111-4111-8111-111111111111';

test('ChatGPT and Grok are equal peer executives under DT', () => {
  const peers = listPeerExecutives();
  assert.deepEqual(peers.map(x => x.id).sort(), ['chatgpt-ceo', 'grok-ceo']);
  assert.ok(peers.every(x => x.standing === 'PEER_EXECUTIVE'));
  assert.ok(peers.every(x => x.gatewayAuthority === 'DT_PLATFORM'));
});

test('Grok peer envelope requires provider, lane, capture and bounded capability', () => {
  const envelope = createPeerEnvelope({
    executiveId: 'grok-ceo', provider: 'xai', sessionId: 'grok-ceo',
    captureSessionId, capability: 'command.propose',
    payload: { command: 'echo GROK_CEO_PING' }
  });
  assert.equal(verifyPeerEnvelope(envelope), true);
  assert.throws(() => createPeerEnvelope({
    executiveId: 'grok-ceo', provider: 'xai', sessionId: 'grok-ceo',
    capability: 'command.propose'
  }), /capture-session/);
});
