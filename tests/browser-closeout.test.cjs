const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('DT browser extension targets all three AI web providers and local controller', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'resources', 'browser-extension', 'manifest.json'), 'utf8'));
  for (const origin of ['https://chatgpt.com/*', 'https://grok.com/*', 'https://gemini.google.com/*', 'http://127.0.0.1:43120/*']) {
    assert.ok(manifest.host_permissions.includes(origin), origin);
  }
  assert.equal(manifest.manifest_version, 3);
});

test('DT core exposes sequential browser closeout capabilities and intent route', () => {
  const caps = fs.readFileSync(path.join(root, 'packages', 'core', 'src', 'core-capabilities.cjs'), 'utf8');
  const runtime = fs.readFileSync(path.join(root, 'packages', 'core', 'src', 'prompt-runtime.cjs'), 'utf8');
  assert.match(caps, /browser\.closeout\.run_all/);
  assert.match(caps, /browser\.closeout\.status/);
  assert.match(runtime, /browser\.closeout\.run_all/);
});
