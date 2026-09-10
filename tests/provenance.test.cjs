const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Vault } = require('../packages/core/src/vault.cjs');
const { appendSeal, createSeal, verifySeal } =
  require('../packages/core/src/provenance.cjs');

test('DT provenance seal verifies the exact artifact and preserves append-only custody', () => {
  const keys = crypto.generateKeyPairSync('ed25519');
  const publicKey = keys.publicKey.export({ type: 'spki', format: 'pem' });
  const privateKey = keys.privateKey.export({ type: 'pkcs8', format: 'pem' });
  const bytes = Buffer.from('owned DT publication');
  const seal = createSeal({
    bytes, owner: 'Thomas “TJ” Cutler', disclosure: 'Human-directed with disclosed AI assistance',
    privateKey, publicKey,
  });
  assert.equal(verifySeal(bytes, seal), true);
  assert.equal(verifySeal(Buffer.from('changed'), seal), false);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-seal-'));
  const vault = new Vault(root);
  const event = appendSeal(vault, seal);
  assert.equal(event.kind, 'DT_PROVENANCE_SEALED');
  assert.equal(vault.all().length, 1);
  assert.equal(JSON.stringify(event).includes(privateKey), false);
});
