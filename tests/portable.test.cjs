const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Vault } = require('../packages/core/src/vault.cjs');
const { createEnvelope, verifyEnvelope } = require('../packages/core/src/protocol.cjs');
const { createBundle, verifyBundle } = require('../packages/core/src/portable.cjs');

test('envelope preserves source class and authority', () => {
  const envelope = createEnvelope({
    sender: 'a',
    recipient: 'b',
    type: 'evidence',
    payload: { value: 1 },
    authority: ['read'],
    sourceClass: 'CANONICAL_SOURCE'
  });
  assert.equal(envelope.sourceClass, 'CANONICAL_SOURCE');
  assert.deepEqual(envelope.authority, ['read']);
  assert.equal(verifyEnvelope(envelope), true);
  assert.equal(verifyEnvelope({ ...envelope, sourceClass: 'NEW_RESEARCH' }), false);
});

test('portable vault bundle verifies and rejects mutation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-portable-'));
  const vault = new Vault(root);
  vault.append('failure', 'branch-retest', { result: 'no signal' });
  vault.append('checkpoint', 'librarian', { state: 'preserved' });
  const bundle = createBundle(vault.all(), { fixture: true });
  const verified = verifyBundle(bundle);
  assert.equal(verified.valid, true);
  assert.equal(verified.recordCount, 2);
  const mutated = JSON.parse(JSON.stringify(bundle));
  mutated.entries[0].data.result = 'changed';
  assert.equal(verifyBundle(mutated).valid, false);
});
