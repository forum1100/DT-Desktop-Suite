const crypto = require('node:crypto');
const { getPeerExecutive } = require('../../auth/src/peers.cjs');

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function validCaptureId(value) {
  return /^[0-9a-f-]{36}$/i.test(String(value || ''));
}

function createPeerEnvelope(input = {}) {
  const peer = getPeerExecutive(input.executiveId);
  if (!peer) throw new Error('Unknown peer executive');
  if (String(input.provider || '') !== peer.provider) throw new Error('Provider does not match peer identity');
  if (String(input.sessionId || '') !== peer.id) throw new Error('Session lane must match peer identity');
  if (!validCaptureId(input.captureSessionId)) throw new Error('Active DT capture-session ID required');
  if (!String(input.capability || '').trim()) throw new Error('Bounded capability required');
  const now = Date.now();
  const expiresAt = input.expiresAt ? Date.parse(input.expiresAt) : now + 60000;
  if (!Number.isFinite(expiresAt) || expiresAt <= now || expiresAt > now + 300000) {
    throw new Error('Peer envelope expiry must be within five minutes');
  }
  const body = {
    schema: 'dt-peer-edge/1.0',
    requestId: crypto.randomUUID(),
    executiveId: peer.id,
    provider: peer.provider,
    standing: peer.standing,
    gatewayAuthority: peer.gatewayAuthority,
    sessionId: peer.id,
    captureSessionId: input.captureSessionId,
    capability: String(input.capability).trim(),
    payload: input.payload ?? null,
    parentRequestId: input.parentRequestId || null,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(expiresAt).toISOString()
  };
  return Object.freeze({ ...body, requestHash: stableHash(body) });
}

function verifyPeerEnvelope(message) {
  if (!message || message.schema !== 'dt-peer-edge/1.0') return false;
  const peer = getPeerExecutive(message.executiveId);
  if (!peer || message.provider !== peer.provider || message.sessionId !== peer.id) return false;
  if (message.standing !== 'PEER_EXECUTIVE' || message.gatewayAuthority !== 'DT_PLATFORM') return false;
  if (!validCaptureId(message.captureSessionId) || Date.parse(message.expiresAt) <= Date.now()) return false;
  const { requestHash, ...body } = message;
  return typeof requestHash === 'string' && requestHash === stableHash(body);
}

module.exports = { createPeerEnvelope, verifyPeerEnvelope, stableHash };
