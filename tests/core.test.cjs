const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { KeyAuthority } = require('../packages/core/src/keys.cjs');
const { Vault } = require('../packages/core/src/vault.cjs');
const { AgentRegistry } = require('../packages/core/src/registry.cjs');
const { Broker } = require('../packages/core/src/broker.cjs');
const { verifyEnvelope } = require('../packages/core/src/protocol.cjs');
const { preflight } = require('../packages/safety/src/preflight.cjs');

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dt-suite-'));

test('keys enforce scopes and revocation without storing plaintext', () => {
  const root = temp();
  const authority = new KeyAuthority(root);
  const issued = authority.issue({ label: 'test', scopes: ['agent:list'] });
  assert.equal(authority.verify(issued.token, 'agent:list').id, issued.id);
  assert.equal(authority.verify(issued.token, 'vault:read'), null);
  assert.equal(fs.readFileSync(path.join(root, 'key-registry.json'), 'utf8').includes(issued.token), false);
  assert.equal(authority.revoke(issued.id), true);
  assert.equal(authority.verify(issued.token, 'agent:list'), null);
});

test('broker validates authority and vault chains events', () => {
  const vault = new Vault(temp());
  const agents = new AgentRegistry([
    { id: 'a', canSend: ['task'], canReceive: ['result'] },
    { id: 'b', canSend: ['result'], canReceive: ['task'] }
  ]);
  const broker = new Broker(vault, agents);
  const message = broker.send({ sender: 'a', recipient: 'b', type: 'task', payload: { value: 1 } });
  assert.equal(verifyEnvelope(message), true);
  assert.equal(vault.all().length, 1);
  assert.throws(() => broker.send({ sender: 'a', recipient: 'b', type: 'result', payload: {} }));
  const one = vault.append('checkpoint', 'a', { n: 1 });
  const two = vault.append('checkpoint', 'a', { n: 2 });
  assert.equal(two.previousHash, one.hash);
});

test('safety preflight blocks unsupported certainty', () => {
  const result = preflight({ text: 'This is guaranteed and cannot fail.', sources: [], status: 'experimental' });
  assert.equal(result.heuristic, true);
  assert.equal(result.mayCertifyTruth, false);
  assert.equal(result.promotionAllowed, false);
});

test('owner identity and two independent recovery tickets', () => {
  const { isOwner } = require('../packages/auth/src/policy.cjs');
  const { RecoveryAuthority } = require('../packages/auth/src/recovery.cjs');
  const root = temp();
  const keys = new KeyAuthority(path.join(root, 'keys'));
  const recovery = new RecoveryAuthority(path.join(root, 'recovery'), keys, 'forum1100');
  assert.equal(isOwner({ githubLogin: 'forum1100' }, 'forum1100'), true);
  assert.equal(isOwner({ githubLogin: 'forum1100' }, 'someone-else'), false);
  const pair = recovery.issuePair();
  assert.equal(pair.length, 2);
  assert.notEqual(pair[0].ticket, pair[1].ticket);
  assert.throws(() => recovery.redeem(pair[0].ticket, 'someone-else'));
  const restored = recovery.redeem(pair[0].ticket, 'forum1100');
  assert.match(restored.token, /^dtk_/);
  assert.throws(() => recovery.redeem(pair[0].ticket, 'forum1100'));
  assert.match(recovery.redeem(pair[1].ticket, 'forum1100').token, /^dtk_/);
});
