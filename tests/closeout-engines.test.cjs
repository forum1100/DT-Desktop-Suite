const test = require('node:test');
const assert = require('node:assert/strict');
const { runEngine, engines } = require('../packages/tools/src/engines.cjs');

test('closeout agents are executable implementation candidates', () => {
  for (const id of ['source-discovery','ingestion-spark','verbatim-archive',
    'derived-model','export-spark','divergence-spark','branch-spark',
    'index-spark','completion-spark','agent-foundry','dt-closeout']) {
    assert.equal(typeof engines[id], 'function', id);
  }
});

test('Foundry refuses production promotion from a form submission', () => {
  const out = runEngine('agent-foundry', {
    candidateId:'X-001', purpose:'bounded test', authority:'none',
    allowedInputs:'test packet', allowedOutputs:'state packet',
    forbiddenActions:'activation', handoffContract:'v1',
    birthState:'DORMANT', testEvidence:'synthetic'
  });
  assert.equal(out.state, 'BOUNDED_CANDIDATE_READY_FOR_SANDBOX');
  assert.equal(out.selfSpawnPermitted, false);
  assert.equal(out.productionPromotion, false);
});

test('closeout remains partial while source gaps survive', () => {
  const out = runEngine('dt-closeout', {
    targetConversation:'chat', terminalBoundary:'message 42',
    canonicalSources:'export.zip', liveCapture:'current chat',
    sourceGaps:'missing middle branch', destination:'Drive',
    approval:'yes'
  });
  assert.equal(out.status, 'PARTIAL');
  assert.equal(out.canonicalReconciliationRequired, true);
  assert.equal(out.overwritePriorCloseoutPermitted, false);
});
