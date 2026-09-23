const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ExperienceLedger } = require('../packages/core/src/experience-ledger.cjs');
const { PerceptionMemory } = require('../packages/core/src/perception-memory.cjs');

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(),'dt-perception-'));

test('every experience event can become an immutable perception point', () => {
  const root=temp(), memory=new PerceptionMemory(root), ledger=new ExperienceLedger(root);
  ledger.setObserver(event=>memory.observe(event));
  const receipt=ledger.append('command-center-input',{text:'hello DT'},{surface:'dt-command-center'});
  const points=memory.recent(10);
  assert.equal(points.length,1);
  assert.equal(points[0].sourceEventId,receipt.local.id);
  assert.equal(points[0].kind,'command-center-input');
  assert.equal(points[0].sourceClass,'LIVE_INTERACTION');
  assert.match(points[0].perceptionHash,/^[0-9a-f]{64}$/);
});
test('perception convergence creates derived memory without mutating source or claiming weight training', () => {
  const root=temp(), memory=new PerceptionMemory(root);
  for(let i=0;i<8;i++) memory.observe({id:String(i),kind:'provider-result',data:{i},context:{surface:'dt-provider-peer'}});
  const derived=memory.derivedRecent(2);
  assert.equal(derived.length,1);
  assert.equal(derived[0].sourceClass,'DERIVED_MEMORY');
  assert.equal(derived[0].sourceMutation,false);
  assert.equal(derived[0].modelWeightsChanged,false);
  assert.equal(derived[0].executableAuthorityGranted,false);
});

test('human-authored reflection artifacts enter source registry with provenance', () => {
  const root=temp(), memory=new PerceptionMemory(root);
  const file=path.join(root,'reflection.md'); fs.writeFileSync(file,'A branch failed because the side quest never returned.');
  const record=memory.ingestArtifact(file,'HUMAN_AUTHORED_REFLECTION');
  assert.equal(record.sourceClass,'HUMAN_AUTHORED_REFLECTION');
  assert.equal(record.canonicalized,false);
  assert.match(record.sha256,/^[0-9a-f]{64}$/);
  assert.equal(memory.recent(5).at(-1).kind,'artifact-ingested');
});