const crypto = require('node:crypto');
const { getPeerExecutive } = require('../../auth/src/peers.cjs');

const MAX_MESSAGE_LENGTH = 12000;

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function createPeerMessage(input = {}) {
  const from = getPeerExecutive(input.from);
  const to = getPeerExecutive(input.to);
  if (!from || !to) throw new Error('Known peer identities are required');
  if (from.id === to.id) throw new Error('Peer chat requires two different peers');
  const text = String(input.text || '').trim();
  if (!text) throw new Error('Peer message text is required');
  if (text.length > MAX_MESSAGE_LENGTH) throw new Error('Peer message is too long');
  const body = {
    schema: 'dt-peer-message/1.0',
    gatewayAuthority: 'DT_PLATFORM',
    capability: 'peer.message',
    from: from.id,
    to: to.id,
    captureSessionId: input.captureSessionId || null,
    text,
    createdAt: new Date().toISOString(),
    executionAuthority: false,
    mouseAuthority: false
  };
  return Object.freeze({ ...body, messageHash: stableHash(body) });
}function verifyPeerMessage(message) {
  if (!message || message.schema !== 'dt-peer-message/1.0') return false;
  const { messageHash, ...body } = message;
  return typeof messageHash === 'string' && messageHash === stableHash(body) &&
    body.gatewayAuthority === 'DT_PLATFORM' && body.capability === 'peer.message' &&
    body.executionAuthority === false && body.mouseAuthority === false &&
    Boolean(getPeerExecutive(body.from)) && Boolean(getPeerExecutive(body.to));
}

module.exports = {
  MAX_MESSAGE_LENGTH,
  createPeerMessage,
  verifyPeerMessage,
  stableHash
};