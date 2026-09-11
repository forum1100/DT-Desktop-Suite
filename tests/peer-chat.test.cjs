const test = require('node:test');
const assert = require('node:assert/strict');
const { createPeerMessage, verifyPeerMessage } = require('../packages/core/src/peer-chat.cjs');

const captureSessionId = '33333333-3333-4333-8333-333333333333';

test('peer chat messages are attributable, hashed, and carry no execution authority', () => {
  const message = createPeerMessage({
    from: 'chatgpt-ceo', to: 'grok-ceo', captureSessionId, text: 'Compare these two branches.'
  });
  assert.equal(message.gatewayAuthority, 'DT_PLATFORM');
  assert.equal(message.capability, 'peer.message');
  assert.equal(message.executionAuthority, false);
  assert.equal(message.mouseAuthority, false);
  assert.equal(verifyPeerMessage(message), true);
});

test('peer chat refuses unknown peers and self-messages', () => {
  assert.throws(() => createPeerMessage({ from: 'unknown', to: 'grok-ceo', text: 'x' }));
  assert.throws(() => createPeerMessage({ from: 'grok-ceo', to: 'grok-ceo', text: 'x' }));
});

test('tampered peer chat messages fail verification', () => {
  const message = createPeerMessage({ from: 'chatgpt-ceo', to: 'grok-ceo', text: 'original' });
  assert.equal(verifyPeerMessage({ ...message, text: 'changed' }), false);
});