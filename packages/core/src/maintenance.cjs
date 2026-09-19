const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createBundle, verifyBundle, verifyEntries } = require('./portable.cjs');

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

class StructuredErrorLog {
  constructor(root) {
    this.root = path.join(root, 'maintenance');
    this.file = path.join(this.root, 'errors.jsonl');
    fs.mkdirSync(this.root, { recursive: true });
  }

  append(error, context = {}) {
    const row = {
      schema: 'dt-structured-error/1.0',
      id: crypto.randomUUID(),
      observedAt: new Date().toISOString(),
      name: String(error?.name || 'Error'),
      message: String(error?.message || error || 'Unknown error'),
      stack: error?.stack ? String(error.stack) : null,
      context,
      sensitivePayloadsDuplicated: false
    };
    fs.appendFileSync(this.file, JSON.stringify(row) + '\n', 'utf8');
    return row;
  }

  list(limit = 100) {
    if (!fs.existsSync(this.file)) return [];
    return fs.readFileSync(this.file, 'utf8').split(/\r?\n/).filter(Boolean)
      .map(line => JSON.parse(line)).slice(-Math.max(1, Number(limit) || 100));
  }
}

class MaintenanceService {
  constructor({ root, vault, errorLog = null }) {
    this.root = root;
    this.vault = vault;
    this.errorLog = errorLog || new StructuredErrorLog(root);
    this.backupRoot = path.join(root, 'backups');
    fs.mkdirSync(this.backupRoot, { recursive: true });
  }

  backup(metadata = {}) {
    const entries = this.vault.all();
    const bundle = createBundle(entries, {
      reason: 'OWNER_OR_MAINTENANCE_BACKUP',
      ...metadata
    });
    const body = Buffer.from(JSON.stringify(bundle, null, 2));
    const file = path.join(this.backupRoot, `dt-vault-${stamp()}.json`);
    const temp = file + '.tmp';
    fs.writeFileSync(temp, body);
    fs.renameSync(temp, file);
    const readback = JSON.parse(fs.readFileSync(file, 'utf8'));
    const verification = verifyBundle(readback);
    const receipt = {
      schema: 'dt-backup-receipt/1.0',
      createdAt: new Date().toISOString(),
      path: file,
      sha256: sha256(fs.readFileSync(file)),
      bytes: fs.statSync(file).size,
      verification
    };
    fs.writeFileSync(file + '.receipt.json', JSON.stringify(receipt, null, 2), 'utf8');
    if (!verification.valid) throw new Error(`BACKUP_READBACK_FAILED:${verification.reason || 'UNKNOWN'}`);
    return receipt;
  }

  integrity() {
    const entries = this.vault.all();
    const chain = verifyEntries(entries);
    const report = {
      schema: 'dt-integrity-report/1.0',
      checkedAt: new Date().toISOString(),
      vault: chain,
      valid: chain.valid === true,
      recordCount: entries.length
    };
    return report;
  }

  restoreTest(backupPath) {
    const bundle = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    const verified = verifyBundle(bundle);
    if (!verified.valid) return { valid: false, stage: 'bundle', verified };
    const testRoot = path.join(this.root, 'maintenance', 'restore-tests', crypto.randomUUID());
    fs.mkdirSync(testRoot, { recursive: true });
    const eventFile = path.join(testRoot, 'events.jsonl');
    fs.writeFileSync(eventFile, bundle.entries.map(row => JSON.stringify(row)).join('\n') + '\n', 'utf8');
    const restored = verifyEntries(fs.readFileSync(eventFile, 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse));
    const result = { valid: restored.valid === true && restored.count === verified.recordCount && restored.headHash === verified.headHash,
      stage: 'reconstructed-vault', backupPath, recordCount: restored.count, headHash: restored.headHash,
      expectedRecordCount: verified.recordCount, expectedHeadHash: verified.headHash, checkedAt: new Date().toISOString() };
    const receiptDir = path.join(this.root, 'maintenance', 'restore-test-receipts');
    fs.mkdirSync(receiptDir, { recursive: true });
    fs.writeFileSync(path.join(receiptDir, `${stamp()}-restore-test.json`), JSON.stringify(result, null, 2), 'utf8');
    fs.rmSync(testRoot, { recursive: true, force: true });
    return result;
  }

  recordError(error, context = {}) {
    return this.errorLog.append(error, context);
  }

  recentErrors(limit = 100) {
    return this.errorLog.list(limit);
  }
}

module.exports = { StructuredErrorLog, MaintenanceService, sha256 };
