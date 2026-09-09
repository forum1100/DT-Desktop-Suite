const { stableHash } = require('./protocol.cjs');

function verifyEntries(entries) {
  if (!Array.isArray(entries)) return { valid: false, index: -1, reason: 'ENTRIES_NOT_ARRAY' };
  let previousHash = null;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry || typeof entry.hash !== 'string') {
      return { valid: false, index, reason: 'HASH_MISSING' };
    }
    if (entry.previousHash !== previousHash) {
      return { valid: false, index, reason: 'CHAIN_LINK_MISMATCH' };
    }
    const { hash, ...body } = entry;
    if (stableHash(body) !== hash) {
      return { valid: false, index, reason: 'ENTRY_HASH_MISMATCH' };
    }
    previousHash = hash;
  }
  return { valid: true, count: entries.length, headHash: previousHash };
}

function createBundle(entries, metadata = {}) {
  const chain = verifyEntries(entries);
  if (!chain.valid) throw new Error('Cannot export invalid vault: ' + chain.reason);
  const body = {
    format: 'DT_CONSUMER_VAULT',
    version: 1,
    exportedAt: new Date().toISOString(),
    recordCount: entries.length,
    headHash: chain.headHash,
    metadata,
    entries
  };
  return { ...body, bundleHash: stableHash(body) };
}

function verifyBundle(bundle) {
  if (!bundle || bundle.format !== 'DT_CONSUMER_VAULT' || bundle.version !== 1) {
    return { valid: false, reason: 'UNSUPPORTED_BUNDLE' };
  }
  const { bundleHash, ...body } = bundle;
  if (stableHash(body) !== bundleHash) {
    return { valid: false, reason: 'BUNDLE_HASH_MISMATCH' };
  }
  const chain = verifyEntries(bundle.entries);
  if (!chain.valid) return chain;
  if (bundle.recordCount !== chain.count || bundle.headHash !== chain.headHash) {
    return { valid: false, reason: 'BUNDLE_SUMMARY_MISMATCH' };
  }
  return {
    valid: true,
    recordCount: chain.count,
    headHash: chain.headHash,
    bundleHash
  };
}

module.exports = { verifyEntries, createBundle, verifyBundle };
