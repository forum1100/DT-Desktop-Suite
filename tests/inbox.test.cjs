const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Vault } = require('../packages/core/src/vault.cjs');
const { AgentRegistry } = require('../packages/core/src/registry.cjs');
const { Broker } = require('../packages/core/src/broker.cjs');
const { agents } = require('../packages/tools/src/agents.cjs');
const { inboxFor, processInbox } = require('../packages/tools/src/inbox.cjs');

test('recipient processes a signed task exactly once and responds to Librarian', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-inbox-'));
  const vault = new Vault(root);
  const registry = new AgentRegistry(agents);
  const broker = new Broker(vault, registry);
  const task = broker.send({
    sender: 'librarian',
    recipient: 'evidence',
    type: 'task',
    payload: { goal: 'Map a claim', materials: 'source fixture' },
    authority: ['consumer-authorized-routing'],
    sourceClass: 'CANONICAL_SOURCE',
    branchId: 'route:evidence'
  });
  assert.equal(inboxFor('evidence', vault).length, 1);
  const first = processInbox('evidence', vault, broker);
  assert.equal(first.processed.length, 1);
  assert.equal(first.processed[0].response.parentId, task.id);
  assert.equal(first.processed[0].response.recipient, 'librarian');
  assert.equal(first.processed[0].result.state, 'AWAITING_STRUCTURED_INPUT');
  assert.equal(first.pendingAfterRun, 0);
  const second = processInbox('evidence', vault, broker);
  assert.equal(second.processed.length, 0);
  assert.equal(second.pendingBeforeRun, 0);
});
