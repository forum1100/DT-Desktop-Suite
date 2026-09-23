const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DTNativeTokenizer, trainDTTokenizer, archiveCompatibilityContract } = require('./dt-tokenizer.cjs');

const digest = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');

class PerceptionMemory {
  constructor(root) {
    this.root = path.join(root, 'perception-memory');
    this.pointsFile = path.join(this.root, 'perception-points.jsonl');
    this.memoryFile = path.join(this.root, 'derived-memory.jsonl');
    this.sourcesFile = path.join(this.root, 'source-registry.jsonl');
    this.tokenizerFile = path.join(this.root, 'dt-tokenizer.json');
    fs.mkdirSync(this.root, { recursive: true });
    this.tokenizer = fs.existsSync(this.tokenizerFile) ? DTNativeTokenizer.load(this.tokenizerFile) : new DTNativeTokenizer();
    if (!fs.existsSync(this.tokenizerFile)) this.tokenizer.save(this.tokenizerFile);
    this.pending = 0;
  }

  observe(event = {}) {
    const point = {
      schema: 'dt-perception-point/1.0', id: crypto.randomUUID(), observedAt: new Date().toISOString(),
      sourceEventId: event.id || null, sourceEventHash: event.hash || digest(event),
      kind: event.kind || 'unknown', sourceClass: event.context?.sourceClass || 'LIVE_INTERACTION',
      surface: event.context?.surface || null, sessionId: event.context?.sessionId || null,
      dataHash: digest(event.data || {}), data: event.data || {}, authorityEffect: 'NONE',
      tokenizerVersion:this.tokenizer.version, tokenizerConfigHash:this.tokenizer.config().configHash,
      dtTokenCount:this.tokenizer.count(JSON.stringify(event.data || {})),
      dtTokenSequenceHash:digest(JSON.stringify(this.tokenizer.encode(JSON.stringify(event.data || {}))))
    };
    point.perceptionHash = digest(point);
    fs.appendFileSync(this.pointsFile, JSON.stringify(point) + '\n', 'utf8');
    this.pending++;
    if (this.pending >= 8) { this.converge(); this.pending = 0; }
    return point;
  }

  recent(limit = 40) {
    if (!fs.existsSync(this.pointsFile)) return [];
    return fs.readFileSync(this.pointsFile,'utf8').split(/\r?\n/).filter(Boolean).slice(-limit).map(line=>JSON.parse(line));
  }
  converge() {
    const rows = this.recent(80);
    const byKind = {}, bySurface = {}, sourceClasses = {};
    for (const row of rows) {
      byKind[row.kind] = (byKind[row.kind] || 0) + 1;
      if (row.surface) bySurface[row.surface] = (bySurface[row.surface] || 0) + 1;
      sourceClasses[row.sourceClass] = (sourceClasses[row.sourceClass] || 0) + 1;
    }
    const memory = {
      schema:'dt-derived-memory/1.0', id:crypto.randomUUID(), generatedAt:new Date().toISOString(),
      sourcePerceptionHashes:rows.map(r=>r.perceptionHash), byKind, bySurface, sourceClasses,
      salient:rows.slice(-16).map(r=>({kind:r.kind,surface:r.surface,sourceClass:r.sourceClass,dataHash:r.dataHash})),
      sourceClass:'DERIVED_MEMORY', sourceMutation:false, modelWeightsChanged:false,
      executableAuthorityGranted:false
    };
    memory.memoryHash = digest(memory);
    fs.appendFileSync(this.memoryFile, JSON.stringify(memory)+'\n','utf8');
    return memory;
  }

  derivedRecent(limit = 12) {
    if (!fs.existsSync(this.memoryFile)) return [];
    return fs.readFileSync(this.memoryFile,'utf8').split(/\r?\n/).filter(Boolean).slice(-limit).map(line=>JSON.parse(line));
  }

  ingestArtifact(file, sourceClass = 'HUMAN_AUTHORED_REFLECTION') {
    const resolved = path.resolve(String(file));
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) throw new Error('Perception source file not found');
    const raw = fs.readFileSync(resolved); const stat = fs.statSync(resolved);
    const record = { schema:'dt-perception-source/1.0', sourceId:crypto.randomUUID(), sourceClass,
      path:resolved, bytes:raw.length, sha256:digest(raw), modifiedAt:new Date(stat.mtimeMs).toISOString(),
      registeredAt:new Date().toISOString(), canonicalized:false, executableAuthorityGranted:false };
    fs.appendFileSync(this.sourcesFile,JSON.stringify(record)+'\n','utf8');
    this.observe({id:record.sourceId,hash:record.sha256,kind:'artifact-ingested',data:record,
      context:{surface:'dt-source-ingestion',sourceClass}});
    return record;
  }

  plannerContext() {
    return { recentPerceptions:this.recent(24).map(r=>({kind:r.kind,surface:r.surface,sourceClass:r.sourceClass,
      data:r.data,perceptionHash:r.perceptionHash})), derivedMemories:this.derivedRecent(4) };
  }

  tokenizerStatus() {
    const config=this.tokenizer.config();
    return { native:config, archiveCompatibility:archiveCompatibilityContract(), modelCompatibilityRule:'TOKENIZER_CONFIG_HASH_MUST_MATCH_MODEL_CHECKPOINT' };
  }

  trainTokenizerGeneration(texts=[], options={}) {
    const next=trainDTTokenizer(texts,options);
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    const candidate=path.join(this.root,'tokenizer-candidates',stamp+'-dt-tokenizer.json');
    fs.mkdirSync(path.dirname(candidate),{recursive:true}); next.save(candidate);
    return {candidatePath:candidate,config:next.config(),promoted:false,requiresModelCompatibilityEvaluation:true};
  }

  promoteTokenizer(file) {
    const candidate=DTNativeTokenizer.load(file);
    candidate.save(this.tokenizerFile); this.tokenizer=candidate;
    return {promoted:true,config:this.tokenizer.config(),path:this.tokenizerFile};
  }
}

module.exports = { PerceptionMemory, digest };

PerceptionMemory.prototype.ingestDirectory = function(root, sourceClass = 'HUMAN_AUTHORED_REFLECTION') {
  const resolved = path.resolve(String(root));
  if (!fs.existsSync(resolved)) return { root: resolved, scanned: 0, ingested: 0, missing: true };
  const allowed = new Set(['.md','.txt','.json','.jsonl','.pdf','.docx','.rtf']);
  let scanned = 0, ingested = 0;
  const stack = [resolved];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current,{withFileTypes:true})) {
      const target = path.join(current,entry.name);
      if (entry.isDirectory()) { stack.push(target); continue; }
      if (!entry.isFile() || !allowed.has(path.extname(entry.name).toLowerCase())) continue;
      scanned++;
      try { this.ingestArtifact(target,sourceClass); ingested++; } catch {}
    }
  }
  return { root:resolved, scanned, ingested, missing:false };
};
