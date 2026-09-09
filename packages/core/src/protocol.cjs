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

function createEnvelope({
  sender,
  recipient,
  type,
  payload,
  authority = [],
  sourceClass = 'PROVENANCE_UNRESOLVED',
  parentId = null,
  branchId = null
}) {
  if (!sender || !recipient || !type) throw new Error('sender, recipient, and type are required');
  if (!SOURCE_CLASSES.includes(sourceClass)) throw new Error('invalid sourceClass');
  const body = {
    version: 1,
    id: crypto.randomUUID(),
    sender,
    recipient,
    type,
    payload,
    authority,
    sourceClass,
    parentId,
    branchId,
    createdAt: new Date().toISOString()
  };
  return Object.freeze({ ...body, hash: stableHash(body) });
}

function verifyEnvelope(message) {
  if (!message || typeof message.hash !== 'string') return false;
  const { hash, ...body } = message;
  const expected = stableHash(body);
  if (hash.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected));
}

module.exports = {
  SOURCE_CLASSES,
  stableHash,
  createEnvelope,
  verifyEnvelope
};
