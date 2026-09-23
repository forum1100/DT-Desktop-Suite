const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

function experienceRecords(experience, terminalText = 'DT_CLOSEOUT') {
  const rows = experience?.recent(5000) || [];
  const records = [];
  let seq = 0;
  for (const row of rows) {
    if (row.kind === 'command-center-input') {
      records.push({ record_type:'NORMALIZED_TURN', speaker:'user', text:String(row.data?.text||''),
        create_time:row.at||null, local_sequence:++seq, source_class:'LIVE_CAPTURE', source_locator:'dt-experience:'+row.id });
    } else if (row.kind === 'command-center-result') {
      records.push({ record_type:'NORMALIZED_TURN', speaker:'assistant', text:JSON.stringify(row.data?.result??null),
        create_time:row.at||null, local_sequence:++seq, source_class:'LIVE_CAPTURE', source_locator:'dt-experience:'+row.id });
    } else if (row.kind === 'command-center-failure' || row.kind === 'terminal-command') {
      records.push({ record_type:'TOOL_VISIBLE_RECORD', speaker:'tool:dt-platform', text:JSON.stringify(row.data??{}),
        create_time:row.at||null, tool_local_sequence:records.length+1, source_class:'LIVE_CAPTURE', source_locator:'dt-experience:'+row.id });
    }
  }
  if (!records.some(r => r.speaker==='user' && String(r.text).trim()===terminalText)) {
    records.push({record_type:'NORMALIZED_TURN',speaker:'user',text:terminalText,create_time:new Date().toISOString(),
      local_sequence:++seq,source_class:'LIVE_CAPTURE',source_locator:'dt-command-center:current'});
  }
  return records;
}

function readJson(file, fallback=null) { try { return JSON.parse(fs.readFileSync(file,'utf8')); } catch { return fallback; } }
function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value,null,2),'utf8'); return file; }

function coordinatorManager(home) { return path.join(home || process.env.USERPROFILE || '', 'Documents', 'TJ_Local_Coordinator', 'closeout_manager.py'); }
function coordinatorCall(home, args) {
  const manager=coordinatorManager(home);
  if(!fs.existsSync(manager)) return {ok:false,error:'CLOSEOUT_COORDINATOR_NOT_FOUND'};
  const proc=spawnSync('python',[manager,...args],{encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:1024*1024*8});
  if(proc.status!==0) return {ok:false,error:String(proc.stderr||proc.stdout||'Coordinator call failed'),exitCode:proc.status};
  try { return {ok:true,result:JSON.parse(String(proc.stdout||'{}'))}; } catch { return {ok:false,error:'COORDINATOR_OUTPUT_PARSE_FAILED',raw:String(proc.stdout||'')}; }
}
async function executeResidentCloseout({ experience, vault, runAgent, executeWorkflow, input = {}, home }) {
  const terminalBoundary = String(input.terminalBoundary || 'DT_CLOSEOUT');
  const root = path.join(home || process.env.USERPROFILE || '', 'Documents', 'DT Platform', 'Closeout');
  fs.mkdirSync(root,{recursive:true});
  const lineageFile = path.join(root,'LINEAGE_CURSOR.json');
  const prior = readJson(lineageFile,{});
  const records = Array.isArray(input.liveRecords) && input.liveRecords.length
    ? input.liveRecords : experienceRecords(experience, terminalBoundary);
  const copier = runAgent('full-conversation-copier', {
    records, terminalBoundary, parentCloseoutHash: prior.closeoutSha256 || null,
    conversationIdentity: input.conversationIdentity || null, sourceClass:'LIVE_CAPTURE'
  });
  const dir = path.join(root, 'DT_CLOSEOUT_' + stamp()); fs.mkdirSync(dir,{recursive:true});
  const archive = path.join(dir,'VERBATIM_CAUSAL_ARCHIVE.jsonl');
  const objects=[...copier.engine.records,
    ...copier.engine.gaps.map((description,i)=>({record_type:'GAP_RESIDUAL',gap_id:'GAP-'+String(i+1).padStart(3,'0'),source_class:'SOURCE_UNAVAILABLE',description})),
    {record_type:'VERIFICATION_SUMMARY',closeout_status:copier.engine.gaps.length?'PARTIAL':'LIVE_CAPTURE_FROZEN',record_count:copier.engine.recordCount,
      terminal_boundary:terminalBoundary,canonical_export_reconciliation:false}];
  const cursor = runAgent('continuation-cursor', { terminalBoundary,lastCapturedSequence:copier.engine.lastCapturedSequence,
    parentCloseoutHash:prior.closeoutSha256||null,nextRequiredSource:'Canonical provider source when available; otherwise continue from the assistant record after this boundary.' });
  objects.push({record_type:'CONTINUATION_CURSOR',...cursor.engine});
  fs.writeFileSync(archive, objects.map(x=>JSON.stringify(x)).join('\n')+'\n','utf8');
  const archiveBytes=fs.readFileSync(archive), archiveHash=sha256(archiveBytes);
  let reconciliation = null;
  if (Array.isArray(input.canonicalRecords) && input.canonicalRecords.length) {
    reconciliation = runAgent('canonical-reconciler', {
      liveRecords: copier.engine.records, canonicalRecords: input.canonicalRecords,
      parentCloseoutHash: prior.closeoutSha256 || null, conversationIdentity: input.conversationIdentity || null
    });
    writeJson(path.join(dir,'CANONICAL_RECONCILIATION.json'), reconciliation.engine);
  }
  const workflow = await executeWorkflow({
    materials:'DT_CLOSEOUT full-chat conversation capture direct enumerator source discovery canonical source source gap ordered turns verbatim reassembly ingestion deduplicate export package readback manifest divergence contradiction branch governance historical authority current authority temporal index lineage index completion definition of done Full Conversation Copier canonical reconciliation continuation cursor persistence verification',
    goal:'Complete live capture under Librarian custody without self-canonicalization; preserve parent/delta lineage, failed branches, residuals, terminal boundary, and explicit gaps.',
    sourceClass:'CURRENT_VALIDATED_STATE'
  });
  const manifest = {
    schema:'dt-closeout-manifest/1.0', createdAt:new Date().toISOString(),
    parentCloseoutHash:prior.closeoutSha256||null, terminalBoundary,
    artifacts:[{name:path.basename(archive),bytes:archiveBytes.length,sha256:archiveHash}],
    librarianCheckpointId:workflow.routed.checkpoint.id,
    librarianCompletionId:workflow.completion.id,
    librarianFailures:workflow.completion.data.failures||[], reconciliationStatus:reconciliation?.engine?.status||'NOT_AVAILABLE'
  };
  writeJson(path.join(dir,'PROVENANCE_MANIFEST.json'),manifest);
  const coordinatorId = crypto.randomUUID();
  const coordinatorStart = coordinatorCall(home, ['start','--source',dir,'--workers','2','--session-id',coordinatorId]);
  let coordinatorStatus = coordinatorStart;
  if (coordinatorStart.ok) {
    for (let i=0;i<20;i++) {
      coordinatorStatus = coordinatorCall(home,['status','--session-id',coordinatorId]);
      const tasks = coordinatorStatus.ok ? (coordinatorStatus.result.tasks || []) : [];
      if (tasks.length && tasks.every(t=>t.status==='DONE' || t.status==='FAILED')) break;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,150);
    }
  }
  const coordinatorSessionDir = path.join(home || process.env.USERPROFILE || '', 'Documents','TJ_Local_Coordinator','closeout_sessions',coordinatorId);
  const coordinatorDriveReceipt = readJson(path.join(coordinatorSessionDir,'drive_replication_receipt.json'),{});
  let persistence = coordinatorDriveReceipt.status === 'VERIFIED'
    ? {status:'PERSISTENCE_VERIFIED',destination:coordinatorDriveReceipt.destination,coordinatorManaged:true}
    : {status:'PERSISTENCE_UNVERIFIED',destination:coordinatorDriveReceipt.destination||null,
       reason:coordinatorDriveReceipt.status||coordinatorStart.error||'COORDINATOR_PERSISTENCE_UNAVAILABLE',coordinatorManaged:true};
  const status = persistence.status==='PERSISTENCE_VERIFIED' && copier.engine.gaps.length===0 && reconciliation?.engine?.status==='RECONCILED'
    ? 'CONTENT_CLOSEOUT_COMPLETE__PERSISTENCE_VERIFIED' : 'PARTIAL';
  const receipt={schema:'dt-closeout-receipt/1.0',operation:'DT_CLOSEOUT',status,createdAt:new Date().toISOString(),
    closeoutDirectory:dir,archive:{path:archive,bytes:archiveBytes.length,sha256:archiveHash},
    parentCloseoutHash:prior.closeoutSha256||null,terminalBoundary,recordCount:copier.engine.recordCount,
    sourceGaps:copier.engine.gaps,reconciliation:reconciliation?.engine?.status||'NOT_AVAILABLE',persistence,
    librarianCheckpointId:workflow.routed.checkpoint.id,librarianCompletionId:workflow.completion.id,
    continuationCursor:cursor.engine,
    coordinator:{sessionId:coordinatorId,start:coordinatorStart,status:coordinatorStatus}};
  const receiptFile=writeJson(path.join(dir,'PERSISTENCE_RECEIPT.json'),receipt);
  const receiptSha256=sha256(fs.readFileSync(receiptFile));
  fs.writeFileSync(path.join(dir,'PERSISTENCE_RECEIPT.sha256'),receiptSha256+'  PERSISTENCE_RECEIPT.json\n','utf8');
  const coordinatorSync = coordinatorStart.ok ? coordinatorCall(home,['sync','--session-id',coordinatorId]) : {ok:false,error:'COORDINATOR_NOT_STARTED'};
  writeJson(path.join(dir,'COORDINATOR_EXECUTION_RECEIPT.json'),{sessionId:coordinatorId,start:coordinatorStart,status:coordinatorStatus,sync:coordinatorSync});
  writeJson(lineageFile,{closeoutSha256:archiveHash,receiptSha256,terminalBoundary,
    lastCapturedSequence:copier.engine.lastCapturedSequence,closeoutDirectory:dir,updatedAt:new Date().toISOString()});
  vault?.append('dt-closeout-completed','dt-closeout',{status,archiveHash,receiptSha256,
    parentCloseoutHash:prior.closeoutSha256||null,terminalBoundary,librarianCompletionId:workflow.completion.id,
    persistenceStatus:persistence.status,sourceGaps:copier.engine.gaps});
  return {...receipt,receiptSha256};
}

module.exports={executeResidentCloseout,experienceRecords};
