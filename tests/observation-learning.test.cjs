const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ObservationLearningIndex } = require('../packages/core/src/observation-learning.cjs');

function fixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-observation-learning-'));
  const root = path.join(base, 'runtime');
  const observationRoot = path.join(base, 'observations');
  fs.mkdirSync(observationRoot, { recursive: true });
  return { base, root, observationRoot };
}

test('observation learning indexes append-only evidence once', () => {
  const { base, root, observationRoot } = fixture();
  try {
    fs.writeFileSync(path.join(observationRoot, 'a.json'), JSON.stringify({
      lesson_type: 'agent-supervision', observed_at: '2026-09-18T00:00:00Z',
      agent: 'librarian', status: 'resident-in-single-shell', provenance: 'test'
    }));
    const index = new ObservationLearningIndex({ root, observationRoot });
    assert.deepEqual(index.ingest(), { scanned: 1, added: 1, skipped: 0 });
    assert.deepEqual(index.ingest(), { scanned: 1, added: 0, skipped: 1 });
    assert.equal(index.list().length, 1);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('observation learning summarizes without granting authority', () => {
  const { base, root, observationRoot } = fixture();
  try {
    for (const [name, row] of Object.entries({
      'a.json': { lesson_type: 'workflow-execution', status: 'recorded', agent: 'dt-closeout' },
      'b.json': { lesson_type: 'agent-execution', status: 'failed', agent: 'source-discovery' }
    })) fs.writeFileSync(path.join(observationRoot, name), JSON.stringify(row));
    const index = new ObservationLearningIndex({ root, observationRoot });
    index.ingest();
    const summary = index.summarize();
    assert.equal(summary.total, 2);
    assert.equal(summary.byStatus.failed, 1);
    assert.equal(summary.authorityEffect, 'NONE');
    assert.equal(summary.modelWeightsChanged, false);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});
