const test = require('node:test');
const assert = require('node:assert/strict');
const { DTNativeTokenizer, trainDTTokenizer, archiveCompatibilityContract,
  DT_SPECIAL_TOKENS } = require('../packages/core/src/dt-tokenizer.cjs');

test('DT native tokenizer is reversible and preserves atomic DT tokens', () => {
  const t = new DTNativeTokenizer();
  const text = 'alpha <PERCEPTION_POINT> beta <BRANCH> gamma';
  const ids = t.encode(text);
  assert.equal(t.decode(ids), text);
  assert.ok(ids.includes(DT_SPECIAL_TOKENS.indexOf('<PERCEPTION_POINT>')));
  assert.ok(ids.includes(DT_SPECIAL_TOKENS.indexOf('<BRANCH>')));
});

test('trained tokenizer preserves reserved token identity', () => {
  const t = trainDTTokenizer(['hello hello hello <BRANCH> hello hello'], { vocabSize: 300 });
  const branchId = DT_SPECIAL_TOKENS.indexOf('<BRANCH>');
  assert.ok(t.encode('<BRANCH>').includes(branchId));
  assert.equal(t.decode(t.encode('hello <BRANCH> hello')), 'hello <BRANCH> hello');
});
test('archive compatibility contract remains exact and fail-closed', () => {
  const c = archiveCompatibilityContract();
  assert.equal(c.encoding, 'o200k_base');
  assert.equal(c.officialVocabularySha256, '446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d');
  assert.equal(c.approximationPermitted, false);
  assert.equal(c.bytesDivFourFallback, false);
  assert.equal(c.structuralParseMaySubstituteForExactCount, false);
});
