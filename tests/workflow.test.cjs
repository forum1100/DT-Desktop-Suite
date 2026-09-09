const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Vault } = require('../packages/core/src/vault.cjs');
const { AgentRegistry } = require('../packages/core/src/registry.cjs');
const { Broker } = require('../packages/core/src/broker.cjs');
const { agents } = require('../packages/tools/src/agents.cjs');
const { routeTask, normalizeSourceClass } = require('../packages/tools/src/workflow.cjs');

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dt-workflow-'));

test('Librarian routes signed provenance-preserving task envelopes', () => {
  const vault = new Vault(temp());
  const registry = new AgentRegistry(agents);
  const broker = new Broker(vault, registry);
  const routed = routeTask({
    materials: 'A source claim contradicts a propulsion energy result',
    goal: 'Map evidence and audit the equation',
    sourceClass: 'CANONICAL_SOURCE'
  }, broker, vault);
  assert.ok(routed.routes.includes('evidence'));
  assert.ok(routed.routes.includes('equation'));
  assert.ok(routed.routes.includes('propulsion'));
  assert.equal(routed.failures.length, 0);
  for (const message of routed.messages) {
    assert.equal(message.sourceClass, 'CANONICAL_SOURCE');
    assert.deepEqual(message.authority, ['consumer-authorized-routing']);
    assert.match(message.hash, /^[0-9a-f]{64}$/);
  }
  assert.equal(routed.checkpoint.data.deliveredMessageIds.length, routed.messages.length);
});

test('unknown provenance is explicit rather than invented', () => {
  assert.equal(normalizeSourceClass('something else'), 'PROVENANCE_UNRESOLVED');
});
