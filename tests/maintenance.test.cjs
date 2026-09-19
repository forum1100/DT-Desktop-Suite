const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Vault } = require('../packages/core/src/vault.cjs');
const { MaintenanceService, StructuredErrorLog } = require('../packages/core/src/maintenance.cjs');

function fixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-maintenance-'));
  const root = path.join(base, 'dt-vault');
  const vault = new Vault(root);
  vault.append('test-event', 'test-agent', { ok: true });
  return { base, root, vault };
}

test('maintenance backup writes verified portable bundle and receipt', () => {
  const { base, root, vault } = fixture();
  try {
    const service = new MaintenanceService({ root, vault });
    const receipt = service.backup({ test: true });
    assert.equal(receipt.verification.valid, true);
    assert.equal(fs.existsSync(receipt.path), true);
    assert.equal(fs.existsSync(receipt.path + '.receipt.json'), true);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('maintenance integrity verifies the live vault chain', () => {
  const { base, root, vault } = fixture();
  try {
    const service = new MaintenanceService({ root, vault });
    const report = service.integrity();
    assert.equal(report.valid, true);
    assert.equal(report.recordCount, 1);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('structured error log preserves machine-readable failure context', () => {
  const { base, root } = fixture();
  try {
    const log = new StructuredErrorLog(root);
    const row = log.append(new Error('boom'), { operation: 'test' });
    assert.equal(row.message, 'boom');
    assert.equal(row.context.operation, 'test');
    assert.equal(log.list().length, 1);
    assert.equal(row.sensitivePayloadsDuplicated, false);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('maintenance restore test reconstructs backup without touching live vault', () => {
  const { base, root, vault } = fixture();
  try {
    const service = new MaintenanceService({ root, vault });
    const backup = service.backup({ test: 'restore' });
    const restored = service.restoreTest(backup.path);
    assert.equal(restored.valid, true);
    assert.equal(restored.recordCount, 1);
    assert.equal(restored.headHash, backup.verification.headHash);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});
