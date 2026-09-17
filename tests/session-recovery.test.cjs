const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readDirtySession, markSessionDirty, clearSessionDirty, markerPath } = require('../packages/core/src/session-recovery.cjs');

test('dirty session marker survives process loss until explicitly cleared', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-session-recovery-'));
  const marked = markSessionDirty(root, { pid:1234, version:'0.2.0' });
  assert.equal(fs.existsSync(markerPath(root)), true);
  assert.equal(readDirtySession(root).pid, 1234);
  assert.equal(marked.version, '0.2.0');
  assert.equal(clearSessionDirty(root), true);
  assert.equal(readDirtySession(root), null);
});
