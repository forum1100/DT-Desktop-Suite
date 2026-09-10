const test = require('node:test');
const assert = require('node:assert/strict');
const { listSimulations, resolveRegisteredSimulation } = require('../packages/simulations/src/replay.cjs');

test('simulation registry preserves runnable and unresolved branches', () => {
  const items = listSimulations();
  assert.ok(items.some(item => item.runnable && item.sourceClass === 'LATER_RECONSTRUCTION'));
  assert.ok(items.some(item => !item.runnable && /RECOVERY|VALIDATION/.test(item.status)));
});

test('simulation resolver cannot escape the registered replay root', () => {
  assert.throws(() => resolveRegisteredSimulation('..\\..\\unauthorized'), /Unknown simulation/);
});
