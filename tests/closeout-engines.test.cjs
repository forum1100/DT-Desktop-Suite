const test = require('node:test');
const assert = require('node:assert/strict');
const { runEngine, engines } = require('../packages/tools/src/engines.cjs');

test('closeout agents are executable implementation candidates', () => {
  for (const id of ['source-discovery','ingestion-spark','verbatim-archive',
    'derived-model','export-spark','divergence-spark','branch-spark',
    'index-spark','completion-spark','agent-foundry','qualification-manager','dt-closeout']) {
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

test('qualification manager blocks incomplete candidates without transferring authority', () => {
  const out = runEngine('qualification-manager', {
    candidateId:'LOCAL-CLOSEOUT-WORKER', sourceIdentity:'ATB-001',
    desktopRole:'closeout worker', lifecycle:'IMPLEMENTATION_CANDIDATE',
    sourceEvidence:'code path verified', authorityEvidence:'read-only task packets',
    permissionGate:'PASS', prismGate:'PASS', teachBackGate:'PENDING',
    takeoverGate:'PENDING', runtimeGate:'PASS', blockingResiduals:'source mapping incomplete'
  });
  assert.equal(out.state, 'QUALIFICATION_BLOCKED');
  assert.equal(out.authorityTransferred, false);
  assert.equal(out.processStarted, false);
});

test('qualification completion still requires attributable promotion', () => {
  const out = runEngine('qualification-manager', {
    candidateId:'LOCAL-CLOSEOUT-WORKER', sourceIdentity:'ATB-001',
    desktopRole:'closeout worker', lifecycle:'IMPLEMENTED_UNVALIDATED',
    sourceEvidence:'source ids and code hash', authorityEvidence:'bounded packet grant',
    permissionGate:'PASS', prismGate:'PASS', teachBackGate:'PASS',
    takeoverGate:'PASS', runtimeGate:'PASS', blockingResiduals:''
  });
  assert.equal(out.state, 'QUALIFICATION_COMPLETE_AWAITING_AUTHORIZED_PROMOTION');
  assert.equal(out.qualificationComplete, true);
  assert.equal(out.selfPromotionPermitted, false);
});

test('full conversation copier freezes exactly through terminal boundary', () => {
  const out = runEngine('full-conversation-copier', {
    records: [
      {speaker:'user',text:'before'},
      {speaker:'assistant',text:'reply'},
      {speaker:'user',text:'DT_CLOSEOUT'},
      {speaker:'assistant',text:'must not be captured'}
    ],
    terminalBoundary:'DT_CLOSEOUT', conversationIdentity:'chat-1', sourceClass:'LIVE_CAPTURE'
  });
  assert.equal(out.recordCount, 3);
  assert.equal(out.records.at(-1).text, 'DT_CLOSEOUT');
  assert.equal(out.currentCloseoutResponseExcluded, true);
  assert.match(out.records[0].exact_text_sha256, /^[0-9a-f]{64}$/);
});

test('continuation cursor preserves parent lineage and exact resume rule', () => {
  const out = runEngine('continuation-cursor', {
    terminalBoundary:'DT_CLOSEOUT', lastCapturedSequence:23,
    parentCloseoutHash:'a'.repeat(64), nextRequiredSource:'canonical export when available'
  });
  assert.equal(out.lastCapturedSequence, 23);
  assert.equal(out.parentCloseoutHash, 'a'.repeat(64));
  assert.equal(out.nextCaptureRule, 'BEGIN_AFTER_PREVIOUS_TERMINAL_BOUNDARY');
  assert.equal(out.overwritePriorCursorPermitted, false);
});
test('canonical reconciler appends metadata without mutating live capture', () => {
  const out = runEngine('canonical-reconciler', {
    liveRecords:[{speaker:'user',text:'hello',exact_text_sha256:'b'.repeat(64)}],
    canonicalRecords:[{role:'user',text:'hello',conversation_id:'c1',message_id:'m1',node_id:'n1',create_time:'2026-09-01T00:00:00Z'}]
  });
  assert.equal(out.status, 'RECONCILED');
  assert.equal(out.liveRecordsMutated, false);
  assert.equal(out.canonicalMetadataAppendOnly, true);
  assert.equal(out.links[0].messageId, 'm1');
});

test('persistence verifier requires hash and byte readback equality', () => {
  const good = runEngine('persistence-verifier', {
    localHash:'c'.repeat(64), readbackHash:'c'.repeat(64), localBytes:42, readbackBytes:42,
    destination:'archive', artifactId:'VERBATIM_CAUSAL_ARCHIVE.jsonl'
  });
  assert.equal(good.status, 'PERSISTENCE_VERIFIED');
  const bad = runEngine('persistence-verifier', {
    localHash:'c'.repeat(64), readbackHash:'d'.repeat(64), localBytes:42, readbackBytes:41
  });
  assert.equal(bad.status, 'PERSISTENCE_UNVERIFIED');
});