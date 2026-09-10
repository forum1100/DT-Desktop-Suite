const crypto = require('node:crypto');

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort()
      .map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function createSeal({ bytes, artifactId = crypto.randomUUID(), version = 1,
  owner, disclosure, sourceClass = 'OWNER_AUTHORIZED',
  previousSealHash = null, privateKey, publicKey }) {
  if (!Buffer.isBuffer(bytes)) throw new TypeError('bytes must be a Buffer');
  if (!owner || !privateKey || !publicKey) throw new Error('owner and signing keys required');
  const statement = {
    schema: 'DT_PROVENANCE_SEAL_V1', artifactId, version,
    owner, mark: 'DT Provenance Seal(TM)', disclosure: disclosure || 'UNSPECIFIED',
    sourceClass, artifactSha256: sha256(bytes), previousSealHash,
    sealedAt: new Date().toISOString(),
  };
  const payload = Buffer.from(canonical(statement));
  return {
    ...statement,
    publicKey,
    signature: crypto.sign(null, payload, privateKey).toString('base64'),
    sealHash: sha256(payload),
  };
}
function verifySeal(bytes, seal) {
  const { signature, publicKey, sealHash, ...statement } = seal;
  if (!Buffer.isBuffer(bytes) || sha256(bytes) !== statement.artifactSha256) return false;
  const payload = Buffer.from(canonical(statement));
  return sha256(payload) === sealHash &&
    crypto.verify(null, payload, publicKey, Buffer.from(signature, 'base64'));
}

function appendSeal(vault, seal, agentId = 'dt-provenance-sealer') {
  if (!vault || typeof vault.append !== 'function') throw new Error('append-only vault required');
  return vault.append('DT_PROVENANCE_SEALED', agentId, {
    artifactId: seal.artifactId, version: seal.version,
    owner: seal.owner, artifactSha256: seal.artifactSha256,
    sealHash: seal.sealHash, previousSealHash: seal.previousSealHash,
    disclosure: seal.disclosure, sourceClass: seal.sourceClass,
    publicKey: seal.publicKey, signature: seal.signature,
  });
}

module.exports = { appendSeal, canonical, createSeal, sha256, verifySeal };
