const crypto = require('node:crypto');

const SOURCE_CLASSES = Object.freeze([
  'CANONICAL_SOURCE',
  'SOURCE_FAITHFUL_EXTRACT',
  'DERIVED_RECONSTRUCTION',
  'NEW_RESEARCH',
  'HISTORICAL_CLAIM_UNVERIFIED',
  'PROVENANCE_UNRESOLVED'
]);

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function createEnvelope({ sender, recipient, type, payload, authority = [], sourceClass, parentId = null, branchId = null }) {
  if (!sender || !recipient || !type) throw new Error('sender, recipient, and type are required');
  if (!SOURCE_CLASSES.includes(sourceClass)) throw new Error('invalid sourceClass');
  const body = { sender, recipient, type, payload, authority, sourceClass, parentId, branchId };
  return Object.freeze({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...body,
    payloadHash: stableHash(payload)
  });
}

function verifyEnvelope(envelope) {
  return Boolean(envelope && envelope.id && envelope.payloadHash === stableHash(envelope.payload));
}

module.exports = { SOURCE_CLASSES, stableHash, createEnvelope, verifyEnvelope };
function createEnvelope({ sender, recipient, type, payload, parentId = null, branchId = null }) {
  if (!sender || !recipient || !type) throw new Error('sender, recipient, and type are required');
  const createdAt = new Date().toISOString();
  const body = { version: 1, id: crypto.randomUUID(), sender, recipient, type, payload, parentId, branchId, createdAt };
  return Object.freeze({ ...body, hash: stableHash(body) });
}

function verifyEnvelope(message) {
  const { hash, ...body } = message;
  return Boolean(hash) && crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(stableHash(body)));
}

module.exports = { SOURCE_CLASSES, stableHash, createEnvelope, verifyEnvelope };
