const crypto = require('node:crypto');

const list = value => Array.isArray(value)
  ? value.filter(Boolean)
  : String(value || '').split(/[\n;,]+/).map(v => v.trim()).filter(Boolean);
const present = value => String(value || '').trim().length > 0;
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

function sourceDiscovery(input) {
  const candidates = list(input.candidateSources);
  const gaps = list(input.knownGaps);
  const canonicalAvailable = /available|verified|located|yes/i.test(String(input.canonicalExportStatus || ''));
  return {
    targetConversation: input.targetConversation || null,
    contactedCandidates: candidates,
    canonicalAvailable,
    explicitGaps: gaps,
    searchBoundary: input.searchBoundary || null,
    state: canonicalAvailable && !gaps.length ? 'SOURCE_SET_READY' : 'SOURCE_DISCOVERY_OPEN',
    reconstructionPermitted: false,
    nextAction: canonicalAvailable ? 'Verify identity, ordering, and hashes.' : 'Continue bounded canonical-source discovery.'
  };
}

function ingestion(input) {
  const hash = String(input.contentHash || '').trim().toLowerCase();
  const hashValid = /^[0-9a-f]{64}$/.test(hash);
  const duplicates = list(input.duplicateCandidates);
  return {
    artifactId: input.artifactId || null,
    sourceClass: input.sourceClass || 'PROVENANCE_UNRESOLVED',
    contentHash: hash || null,
    hashValid,
    duplicateCandidates: duplicates,
    confidentiality: input.confidentiality || null,
    stagingLocation: input.stagingLocation || null,
    state: !hashValid ? 'INVALID_HASH'
      : duplicates.length ? 'STAGED_DUPLICATE_REFERENCE' : 'STAGED_UNIQUE_CANDIDATE',
    canonicalized: false,
    authorityGranted: false,
    invariant: 'READ != WRITE != CANONICALIZE'
  };
}

function verbatimArchive(input) {
  const records = list(input.records);
  const gaps = list(input.exactGaps);
  const canonical = input.sourceClass === 'CANONICAL_SOURCE';
  return {
    conversationId: input.conversationId || null,
    sourceClass: input.sourceClass || 'PROVENANCE_UNRESOLVED',
    recordCount: records.length,
    records,
    orderingEvidence: input.orderingEvidence || null,
    explicitGaps: gaps,
    terminalBoundary: input.terminalBoundary || null,
    archiveStatus: canonical && !gaps.length ? 'CANONICAL_SOURCE_SLICE' : 'PARTIAL_SOURCE_FAITHFUL_ARCHIVE',
    derivedProsePermitted: false,
    omittedTextReconstructed: false
  };
}
function derivedModel(input) {
  return {
    sourceArtifactIds: list(input.sourceArtifactIds),
    concepts: list(input.concepts),
    equations: list(input.equations),
    decisions: list(input.decisions),
    failures: list(input.failures),
    branches: list(input.branches),
    residuals: list(input.residuals),
    limitations: list(input.limitations),
    sourceClass: 'DERIVED_RECONSTRUCTION',
    canonicalSourceMutation: false
  };
}

function exportSpark(input) {
  const sources = list(input.sourceComponents);
  const derived = list(input.derivedComponents);
  const hashes = list(input.hashes);
  const gaps = list(input.gaps);
  const manifestPresent = present(input.manifest);
  const readbackVerified = /verified|match|pass/i.test(String(input.readbackEvidence || ''));
  return {
    components: { source: sources, derived },
    separationPreserved: sources.length > 0 && derived.length > 0,
    manifestPresent,
    hashes,
    readbackVerified,
    gaps,
    destination: input.destination || null,
    status: !manifestPresent || !hashes.length || !readbackVerified ? 'EXPORT_UNVERIFIED'
      : gaps.length ? 'VERIFIED_EXPORT_WITH_EXPLICIT_GAPS' : 'VERIFIED_EXPORT',
    canonicalityEffect: 'NONE'
  };
}
function divergenceSpark(input) {
  const a = String(input.recordA || '');
  const b = String(input.recordB || '');
  const divergent = a !== b;
  return {
    logicalSubject: input.logicalSubject || null,
    recordA: input.recordA || null,
    recordB: input.recordB || null,
    basisA: input.basisA || null,
    basisB: input.basisB || null,
    temporalScope: input.temporalScope || null,
    divergenceDetected: divergent,
    divergenceType: divergent ? 'CONTRADICTORY_OR_CHANGED_OBSERVATION' : 'NO_MATERIAL_TEXT_DIVERGENCE',
    authorityDecisionPerformed: false,
    scientificTruthAdjudicated: false,
    sourceMutation: false
  };
}

function branchSpark(input) {
  const historical = list(input.historicalAuthority);
  const successor = list(input.successorEvidence);
  const complete = historical.length && successor.length && present(input.divergenceRecord)
    && present(input.decisionRule) && present(input.rationale);
  return {
    logicalSubject: input.logicalSubject || null,
    historicalAuthority: historical,
    successorEvidence: successor,
    divergenceRecord: input.divergenceRecord || null,
    decisionRule: input.decisionRule || null,
    rationale: input.rationale || null,
    status: complete ? 'SUCCESSOR_GOVERNANCE_RECORDED' : 'GOVERNANCE_INCOMPLETE',
    historicalAuthorityRewritten: false,
    failedBranchesDeleted: false,
    currentAuthorityEqualsHistoricalAuthority: false
  };
}
function indexSpark(input) {
  return {
    logicalSubject: input.logicalSubject || null,
    artifacts: list(input.artifacts),
    edges: list(input.edges),
    historicalAuthority: list(input.historicalAuthority),
    currentAuthority: list(input.currentAuthority),
    predecessorIndex: input.predecessorIndex || null,
    relationship: present(input.predecessorIndex) ? 'SUCCESSOR_INDEX' : 'INITIAL_INDEX',
    custodyChanged: false,
    canonicalityChanged: false,
    historyAltered: false
  };
}

function completionSpark(input) {
  const required = ['objective', 'owner', 'acceptanceCriteria', 'sources', 'implementationVersion',
    'testResults', 'failures', 'securityReview', 'claimStatus', 'registryStatus',
    'checkpointHash', 'releaseStatus', 'unresolvedRisks'];
  const missing = required.filter(key => !present(input[key]));
  const risksOpen = !/^(none|no unresolved risks|closed)$/i.test(String(input.unresolvedRisks || '').trim());
  return {
    objective: input.objective || null,
    owner: input.owner || null,
    missing,
    unresolvedRisks: list(input.unresolvedRisks),
    status: !missing.length && !risksOpen ? 'COMPLETE' : 'PARTIAL',
    canonicalityEffect: 'NONE',
    persistenceEqualsCompletion: false,
    documentExistsEqualsDone: false
  };
}
function agentFoundry(input) {
  const required = ['candidateId', 'purpose', 'authority', 'allowedInputs', 'allowedOutputs',
    'forbiddenActions', 'handoffContract', 'birthState', 'testEvidence'];
  const missing = required.filter(key => !present(input[key]));
  return {
    candidateId: input.candidateId || null,
    purpose: input.purpose || null,
    authority: list(input.authority),
    allowedInputs: list(input.allowedInputs),
    allowedOutputs: list(input.allowedOutputs),
    forbiddenActions: list(input.forbiddenActions),
    handoffContract: input.handoffContract || null,
    birthState: input.birthState || null,
    testEvidence: list(input.testEvidence),
    state: missing.length ? 'INCOMPLETE_CANDIDATE' : 'BOUNDED_CANDIDATE_READY_FOR_SANDBOX',
    missing,
    selfSpawnPermitted: false,
    selfCanonicalizePermitted: false,
    productionPromotion: false
  };
}

function qualificationManager(input) {
  const lifecycle=String(input.lifecycle||'UNKNOWN').trim().toUpperCase();
  const allowedLifecycles=['SPECIFIED_ONLY','DORMANT_SPEC','IMPLEMENTATION_CANDIDATE',
    'IMPLEMENTED_UNVALIDATED','VALIDATED','RUNNING','RETIRED','SUPERSEDED','UNKNOWN'];
  const gateNames=['permissionGate','prismGate','teachBackGate','takeoverGate','runtimeGate'];
  const gates=Object.fromEntries(gateNames.map(name=>[name,String(input[name]||'PENDING').trim().toUpperCase()]));
  const invalidGates=Object.entries(gates).filter(([,value])=>!['PASS','FAIL','PENDING','NOT_APPLICABLE'].includes(value));
  const residuals=list(input.blockingResiduals);
  const mappingComplete=present(input.candidateId)&&present(input.sourceIdentity)&&present(input.desktopRole);
  const evidenceComplete=present(input.sourceEvidence)&&present(input.authorityEvidence);
  const allPassed=Object.values(gates).every(value=>value==='PASS'||value==='NOT_APPLICABLE');
  const eligible=mappingComplete&&evidenceComplete&&allowedLifecycles.includes(lifecycle)&&!invalidGates.length&&allPassed&&!residuals.length;
  return {
    candidateId:input.candidateId||null,sourceIdentity:input.sourceIdentity||null,
    desktopRole:input.desktopRole||null,lifecycle,gates,blockingResiduals:residuals,
    mappingComplete,evidenceComplete,qualificationComplete:eligible,
    state:eligible?'QUALIFICATION_COMPLETE_AWAITING_AUTHORIZED_PROMOTION':'QUALIFICATION_BLOCKED',
    invalidGates:invalidGates.map(([name,value])=>({name,value})),
    selfPromotionPermitted:false,authorityTransferred:false,processStarted:false,
    nextAction:eligible?'Request an attributable lifecycle transition.':'Resolve missing evidence, failed or pending gates, and blocking residuals.'
  };
}

const CLOSEOUT_PHASES = Object.freeze([
  'SOURCE_DISCOVERY', 'VERBATIM_ARCHIVE', 'DERIVED_MODEL',
  'DIVERGENCE_REVIEW', 'BRANCH_GOVERNANCE', 'TEMPORAL_INDEX',
  'VERIFIED_EXPORT', 'COMPLETION_GATE', 'LIBRARIAN_CUSTODY'
]);
function dtCloseout(input) {
  const canonicalSources = list(input.canonicalSources);
  const gaps = list(input.sourceGaps);
  const liveCapture = list(input.liveCapture);
  const approved = /yes|approved|true/i.test(String(input.approval || ''));
  const terminal = present(input.terminalBoundary);
  const status = canonicalSources.length && !gaps.length && terminal && approved
    ? 'READY_FOR_PHASED_EXECUTION' : 'PARTIAL';
  return {
    targetConversation: input.targetConversation || null,
    terminalBoundary: input.terminalBoundary || null,
    canonicalSources,
    liveCapture,
    sourceGaps: gaps,
    destination: input.destination || null,
    approvalRecorded: approved,
    phases: CLOSEOUT_PHASES,
    status,
    minimumArchiveStandard: 'VERBATIM_REASSEMBLY_EQUIVALENT',
    targetArchiveStandard: 'LIVE_CHAT_SUPERSET',
    providerExportRequired: false,
    providerExportRequestPermittedByDefault: false,
    triggerPhrase: 'DT_CLOSEOUT',
    liveCaptureSourceClass: 'LIVE_CURRENT_CONTEXT',
    liveCaptureIsActiveSource: liveCapture.length > 0,
    summaryMaySubstituteForSource: false,
    verbatimReassemblyAssessmentRequired: true,
    modelContextAssumedComplete: false,
    canonicalReconciliationRequired: !canonicalSources.length || gaps.length > 0,
    currentCloseoutExcludedFromCapturedBoundary: true,
    overwritePriorCloseoutPermitted: false,
    completionClaimPermitted: status === 'READY_FOR_PHASED_EXECUTION'
  };
}

function desktopControl(input) {
  const action=String(input.action||'').trim().toUpperCase();
  const allowed=['MOVE','LEFT_CLICK','RIGHT_CLICK','SCROLL'];
  const x=Number(input.x), y=Number(input.y), scrollAmount=Number(input.scrollAmount||0);
  const missing=[];
  if(!present(input.authorizedTask)) missing.push('authorizedTask');
  if(!allowed.includes(action)) missing.push('validAction');
  if(action!=='SCROLL'&&(!Number.isInteger(x)||!Number.isInteger(y))) missing.push('integerCoordinates');
  if(action==='SCROLL'&&(!Number.isInteger(scrollAmount)||Math.abs(scrollAmount)>1200)) missing.push('boundedScrollAmount');
  return { authorizedTask:input.authorizedTask||null, proposedAction:{action,x,y,scrollAmount},
    state:missing.length?'INCOMPLETE_ACTION':'READY_FOR_VISIBLE_QUEUE',missing,
    executed:false,activeCaptureRequired:true,singleUseApprovalRequired:true,
    typingPermitted:false,unattendedMacroPermitted:false };
}

function agentSupervisor(input) {
  let snapshot={workers:[]}, parseError=null;
  try { snapshot=typeof input.workerSnapshot==='string'?JSON.parse(input.workerSnapshot):input.workerSnapshot||snapshot; }
  catch(error){ parseError=error.message; }
  const workers=Array.isArray(snapshot.workers)?snapshot.workers:[];
  const desired=Math.max(1,Math.min(20,Number(input.desiredMaxPerRole)||1));
  const protectedSet=new Set(list(input.protectedWorkers));
  const groups={};
  for(const worker of workers){const role=worker.role||'UNKNOWN';(groups[role]??=[]).push(worker);}
  const candidates=[];
  for(const [role,rows] of Object.entries(groups)){
    const eligible=rows.filter(w=>w.alive&&w.status==='IDLE'&&!protectedSet.has(w.worker_id))
      .sort((a,b)=>(a.task_count||0)-(b.task_count||0));
    const excess=Math.max(0,rows.filter(w=>w.alive).length-desired);
    candidates.push(...eligible.slice(0,excess).map(w=>({workerId:w.worker_id,role,pid:w.pid,
      reason:'IDLE_DUPLICATE_CANDIDATE',taskCount:w.task_count||0})));
  }
  return {observedWorkers:workers.length,desiredMaxPerRole:desired,protectedWorkers:[...protectedSet],
    constraints:list(input.constraints),parseError,consolidationCandidates:candidates,
    autoTerminationPermitted:false,historyDeletionPermitted:false,
    status:parseError?'INVALID_SNAPSHOT':'PLAN_ONLY_EXPLICIT_TERMINATION_REQUIRED'};
}

function operationsHistorian(input) {
  const runs=list(input.agentRuns), failures=list(input.failures);
  const concurrency=list(input.concurrencyWindows), gaps=list(input.idleGaps);
  const constraints=list(input.constraints);
  const recommendations=[];
  if (failures.length) recommendations.push('Cluster failures by dependency and branch before retrying.');
  if (gaps.length) recommendations.push('Compare idle gaps with queue and authority availability.');
  if (!concurrency.length) recommendations.push('Capture overlapping start/end windows before changing swarm size.');
  if (!runs.length) recommendations.push('Collect actual run records; declared agents are not active agents.');
  return { observationWindow:input.observationWindow||null, runs, failures,
    concurrencyWindows:concurrency, idleGaps:gaps, constraints,
    usageMeasures:list(input.usageMeasures), durations:list(input.durations),
    recommendations, mutationAuthority:false, autoSpawnPermitted:false,
    status:runs.length?'OBSERVED_HISTORY_ANALYZED':'EVIDENCE_NEEDED',
    invariant:'LONGER_RUNTIME != GREATER_VALIDATED_YIELD' };
}

function suiteReleaseManager(input) {
  const tests=list(input.testEvidence), changes=list(input.changes);
  const approved=/yes|approved|true/i.test(String(input.ownerApproval||''));
  const gates={repository:present(input.repository),changes:changes.length>0,
    tests:tests.length>0,security:present(input.securityReview),
    rollback:present(input.rollbackPoint),destination:present(input.releaseDestination),
    approval:approved};
  const missing=Object.entries(gates).filter(([,v])=>!v).map(([k])=>k);
  return { repository:input.repository||null,currentVersion:input.currentVersion||null,
    targetVersion:input.targetVersion||null,changes,
    dependencyUpdates:list(input.dependencyUpdates),testEvidence:tests,gates,missing,
    status:missing.length?'RELEASE_BLOCKED':'READY_FOR_OWNER_AUTHORIZED_PUBLICATION',
    pushed:false,merged:false,credentialsChanged:false,
    rollbackPoint:input.rollbackPoint||null };
}

const closeoutEngines = {
  'source-discovery': sourceDiscovery,
  'ingestion-spark': ingestion,
  'verbatim-archive': verbatimArchive,
  'derived-model': derivedModel,
  'export-spark': exportSpark,
  'divergence-spark': divergenceSpark,
  'branch-spark': branchSpark,
  'index-spark': indexSpark,
  'completion-spark': completionSpark,
  'agent-foundry': agentFoundry,
  'qualification-manager': qualificationManager,
  'dt-closeout': dtCloseout,
  'desktop-control': desktopControl,
  'agent-supervisor': agentSupervisor,
  'operations-historian': operationsHistorian,
  'suite-release-manager': suiteReleaseManager
};

module.exports = { closeoutEngines, CLOSEOUT_PHASES, list, digest };
