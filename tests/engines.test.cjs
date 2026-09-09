const test = require('node:test');
const assert = require('node:assert/strict');
const { runEngine } = require('../packages/tools/src/engines.cjs');
const { runAgent } = require('../packages/tools/src/runner.cjs');

test('evidence engine preserves contradiction topology', () => {
  const out = runEngine('evidence', {
    claim: 'A',
    source: 'source-one; source-two',
    interpretation: 'candidate reading',
    contradiction: 'conflict-one'
  });
  assert.equal(out.topology.sourceCount, 2);
  assert.equal(out.topology.contradictionCount, 1);
  assert.equal(out.topology.requiresResolution, true);
  assert.equal(out.evidentiaryStatus, 'SOURCE_ATTACHED_NOT_INDEPENDENTLY_VERIFIED');
});

test('propulsion engine audits entered conservation values', () => {
  const out = runEngine('propulsion', {
    systemBoundary: 'vehicle',
    referenceFrame: 'lab',
    mass: 2,
    inputEnergy: 20,
    predictedImpulse: 10,
    heat: 'measured',
    wake: 'measured'
  });
  assert.equal(out.calculation.minimumKineticEnergy, 25);
  assert.equal(out.calculation.energyMargin, -5);
  assert.ok(out.auditFlags.includes('ENERGY_DEFICIT_UNDER_ENTERED_VALUES'));
  assert.equal(out.scientificStatus, 'CALCULATION_ONLY_NOT_PHYSICAL_VALIDATION');
});

test('prism refuses incomplete defensive preflight', () => {
  const out = runEngine('prism', {
    authorizedBoundary: 'local synthetic fixture',
    syntheticCanary: 'marker'
  });
  assert.equal(out.runPermitted, false);
  assert.equal(out.activeIntrusionOrCredentialCapturePermitted, false);
  assert.ok(out.missingControls.includes('rollback'));
});

test('civilization output stays a heuristic scenario', () => {
  const out = runEngine('civilization', {
    resources: 'energy; water',
    constraints: 'heat; conflict; scarcity',
    institutions: 'local council'
  });
  assert.equal(out.pressureIndex, 1);
  assert.equal(out.scientificStatus, 'SCENARIO_HEURISTIC_NOT_FORECAST');
});

test('agent runner includes engine result and safety receipt', () => {
  const out = runAgent('telemetry', {
    counterType: 'weighted token',
    observedValue: '8166',
    scope: 'unknown',
    source: 'visible runtime message',
    unknownFields: 'initial allocation; weighting formula'
  });
  assert.equal(out.engine.totalRecoverable, false);
  assert.equal(out.safety.mayCertifyTruth, false);
});
