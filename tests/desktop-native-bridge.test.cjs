const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const main = fs.readFileSync(path.join(__dirname, '..', 'apps', 'desktop', 'src', 'main.cjs'), 'utf8');
const renderer = fs.readFileSync(path.join(__dirname, '..', 'apps', 'desktop', 'src', 'renderer.js'), 'utf8');

test('native mouse events pass an explicit UIntPtr', () => {
  const calls = [...main.matchAll(/\[Cursor\]::mouse_event\(([^)]*)\)/g)].map(match => match[1]);
  assert.ok(calls.length >= 3);
  assert.ok(calls.every(call => call.includes('[UIntPtr]::Zero')));
});

test('native cursor failures are preserved before surfacing', () => {
  assert.match(main, /CURSOR_EXECUTION_FAILURE/);
  assert.match(main, /cursor-action-failed/);
});

test('safe scroll fixture moves downward from the top boundary', () => {
  assert.match(renderer, /scrollPad\.scrollTop=0/);
  assert.match(renderer, /action==='SCROLL'\?-240:0/);
});
