const test = require('node:test');
const assert = require('node:assert/strict');
const { runEngine } = require('../packages/tools/src/engines.cjs');

test('hallucination engine identifies unsupported authority without certifying truth', () => {
  const out = runEngine('hallucination', {
    text: 'According to experts, this is proven.',
    sources: ''
  });
  assert.ok(out.flags.includes('VAGUE_AUTHORITY'));
  assert.ok(out.flags.includes('ABSOLUTE_LANGUAGE'));
  assert.equal(out.truthCertified, false);
  assert.equal(out.reviewPriority, 'HIGH');
});

test('branch retest preserves the historical failure', () => {
  const out = runEngine('branch-retest', {
    historicalBranch: 'B-01',
    originalFailure: 'no signal',
    newBasis: 'new paired branch',
    prediction: 'signal returns only in pair',
    rival: 'measurement drift',
    failureCondition: 'no paired signal'
  });
  assert.equal(out.originalFailurePreserved, true);
  assert.equal(out.state, 'READY_FOR_EXECUTION');
  assert.equal(out.rivalExplanation, 'measurement drift');
});
test('equation engine returns bounded constraint and audit status', () => {
  const out = runEngine('equation', {
    equation: 'C = 1 - Pf/P0',
    variables: 'P0; Pf',
    units: 'dimensionless',
    assumptions: 'P0 nonzero',
    p0: 10,
    pf: 4
  });
  assert.equal(out.constraint, 0.6);
  assert.equal(out.auditFlags.length, 0);
  assert.equal(out.status, 'BOUNDED_CALCULATION_NOT_ESTABLISHED_PHYSICS');
});

test('prediction engine freezes paper record and detects direction conflict', () => {
  const out = runEngine('prediction', {
    direction: 'up',
    baseline: 100,
    target: 90,
    invalidation: 80,
    horizon: '30 days',
    confidence: '55%',
    rival: 'market reversal'
  });
  assert.equal(out.frozen, true);
  assert.equal(out.expectedChange, -10);
  assert.equal(out.expectedChangePercent, -10);
  assert.equal(out.directionConflict, true);
  assert.equal(out.mode, 'PAPER_ONLY_UNTESTED');
});
