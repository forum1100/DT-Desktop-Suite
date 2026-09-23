const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyCommandCenterInput } = require('../packages/core/src/command-center-router.cjs');

test('natural language defaults to DT prompt routing', () => {
  const result = classifyCommandCenterInput('please inspect the desktop platform and fix the bridge');
  assert.equal(result.route, 'PROMPT');
  assert.equal(result.reason, 'NATURAL_LANGUAGE_DEFAULT');
});

test('owner home and connect aliases remain executable commands', () => {
  assert.equal(classifyCommandCenterInput('girls im home').route, 'SHELL');
  assert.equal(classifyCommandCenterInput('connect me').route, 'SHELL');
});

test('explicit shell prefixes route only their payload to the shell', () => {
  assert.deepEqual(classifyCommandCenterInput('/shell Get-Process'), {
    route: 'SHELL', payload: 'Get-Process', reason: 'EXPLICIT_SHELL_PREFIX'
  });
  assert.equal(classifyCommandCenterInput('$ Get-Date').payload, 'Get-Date');
  assert.equal(classifyCommandCenterInput('run whoami').payload, 'whoami');
});

test('explicit ask prefix stays in DT prompt runtime', () => {
  const result = classifyCommandCenterInput('/ask summarize recent failures');
  assert.equal(result.route, 'PROMPT');
  assert.equal(result.payload, 'summarize recent failures');
});
