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

test('DT closeout is provider-export independent and requires verbatim reassembly', () => {
  const out = runEngine('dt-closeout', {
    targetConversation:'chat', terminalBoundary:'current terminal turn',
    liveCapture:'current chat', approval:'yes'
  });
  assert.equal(out.minimumArchiveStandard, 'VERBATIM_REASSEMBLY_EQUIVALENT');
  assert.equal(out.targetArchiveStandard, 'LIVE_CHAT_SUPERSET');
  assert.equal(out.providerExportRequired, false);
  assert.equal(out.providerExportRequestPermittedByDefault, false);
  assert.equal(out.triggerPhrase, 'DT_CLOSEOUT');
  assert.equal(out.liveCaptureSourceClass, 'LIVE_CURRENT_CONTEXT');
  assert.equal(out.liveCaptureIsActiveSource, true);
  assert.equal(out.summaryMaySubstituteForSource, false);
  assert.equal(out.verbatimReassemblyAssessmentRequired, true);
  assert.equal(out.modelContextAssumedComplete, false);
});


test('desktop control only prepares a bounded visible action', () => {
  const out = runEngine('desktop-control', {
    authorizedTask:'test cursor movement', action:'MOVE', x:'100', y:'200', scrollAmount:'0'
  });
  assert.equal(out.state, 'READY_FOR_VISIBLE_QUEUE');
  assert.equal(out.executed, false);
  assert.equal(out.activeCaptureRequired, true);
  assert.equal(out.typingPermitted, false);
});

test('agent supervisor proposes idle duplicates without terminating them', () => {
  const out = runEngine('agent-supervisor', {
    workerSnapshot: JSON.stringify({workers:[
      {worker_id:'a',role:'CLOSEOUT',alive:true,status:'IDLE',task_count:2,pid:1},
      {worker_id:'b',role:'CLOSEOUT',alive:true,status:'IDLE',task_count:0,pid:2}
    ]}),
    desiredMaxPerRole:'1', protectedWorkers:'a', constraints:'preserve history'
  });
  assert.equal(out.consolidationCandidates[0].workerId, 'b');
  assert.equal(out.autoTerminationPermitted, false);
  assert.equal(out.historyDeletionPermitted, false);
});
