const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}

class ObservationLearningIndex {
  constructor({ root, observationRoot }) {
    this.root = path.join(root, 'learning');
    this.observationRoot = observationRoot;
    this.indexFile = path.join(this.root, 'observation-index.jsonl');
    fs.mkdirSync(this.root, { recursive: true });
  }

  existingHashes() {
    if (!fs.existsSync(this.indexFile)) return new Set();
    return new Set(fs.readFileSync(this.indexFile, 'utf8').split(/\r?\n/)
      .filter(Boolean).map(line => { try { return JSON.parse(line).sourceHash; } catch { return null; } })
      .filter(Boolean));
  }
  ingest() {
    if (!fs.existsSync(this.observationRoot)) return { scanned: 0, added: 0, skipped: 0 };
    const known = this.existingHashes();
    const files = fs.readdirSync(this.observationRoot)
      .filter(name => name.endsWith('.json')).sort();
    let added = 0, skipped = 0;
    for (const name of files) {
      const file = path.join(this.observationRoot, name);
      const raw = fs.readFileSync(file);
      const sourceHash = sha256(raw);
      if (known.has(sourceHash)) { skipped++; continue; }
      const row = readJson(file);
      if (!row) { skipped++; continue; }
      const record = {
        schema: 'dt-observation-learning/1.0',
        sourceHash,
        sourceFile: file,
        observedAt: row.observed_at || null,
        lessonType: row.lesson_type || 'unknown',
        agent: row.agent || null,
        status: row.status || null,
        workflowKind: row.workflow_kind || null,
        vaultReceipt: row.vault_receipt || null,
        provenance: row.provenance || null,
        authorityEffect: 'NONE',
        executablePromotion: false,
        indexedAt: new Date().toISOString()
      };
      fs.appendFileSync(this.indexFile, JSON.stringify(record) + '\n', 'utf8');
      known.add(sourceHash); added++;
    }
    return { scanned: files.length, added, skipped };
  }
  list() {
    if (!fs.existsSync(this.indexFile)) return [];
    return fs.readFileSync(this.indexFile, 'utf8').split(/\r?\n/).filter(Boolean)
      .map(line => JSON.parse(line));
  }

  summarize() {
    const rows = this.list();
    const byType = {}, byStatus = {}, byAgent = {};
    for (const row of rows) {
      byType[row.lessonType] = (byType[row.lessonType] || 0) + 1;
      if (row.status) byStatus[row.status] = (byStatus[row.status] || 0) + 1;
      if (row.agent) byAgent[row.agent] = (byAgent[row.agent] || 0) + 1;
    }
    return {
      schema: 'dt-observation-learning-summary/1.0',
      total: rows.length,
      byType,
      byStatus,
      byAgent,
      authorityEffect: 'NONE',
      modelWeightsChanged: false,
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = { ObservationLearningIndex, sha256 };
