const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { stableHash } = require('./protocol.cjs');

const LOCK_TIMEOUT_MS = 5000;
const STALE_LOCK_MS = 30000;
const SLEEP_ARRAY = new Int32Array(new SharedArrayBuffer(4));

function sleepSync(ms) {
  Atomics.wait(SLEEP_ARRAY, 0, 0, ms);
}

class Vault {
  constructor(root) {
    this.root = root;
    this.log = path.join(root, 'events.jsonl');
    this.lockDir = path.join(root, '.append-lock');
    fs.mkdirSync(root, { recursive: true });
  }

  acquireAppendLock() {
    const started = Date.now();
    for (;;) {
      try {
        fs.mkdirSync(this.lockDir);
        fs.writeFileSync(path.join(this.lockDir, 'owner.json'), JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }), 'utf8');
        return () => fs.rmSync(this.lockDir, { recursive: true, force: true });
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        try {
          const age = Date.now() - fs.statSync(this.lockDir).mtimeMs;
          if (age > STALE_LOCK_MS) {
            fs.rmSync(this.lockDir, { recursive: true, force: true });
            continue;
          }
        } catch {}
        if (Date.now() - started > LOCK_TIMEOUT_MS) {
          throw new Error('VAULT_APPEND_LOCK_TIMEOUT');
        }
        sleepSync(10);
      }
    }
  }

  append(kind, agentId, data) {
    const release = this.acquireAppendLock();
    try {
      const previous = this.last();
      const entry = {
        id: crypto.randomUUID(), kind, agentId, data,
        createdAt: new Date().toISOString(),
        previousHash: previous?.hash || null
      };
      entry.hash = stableHash(entry);
      fs.appendFileSync(this.log, JSON.stringify(entry) + '\n', 'utf8');
      return entry;
    } finally {
      release();
    }
  }

  all() {
    if (!fs.existsSync(this.log)) return [];
    return fs.readFileSync(this.log, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map(JSON.parse);
  }

  last() {
    const rows = this.all();
    return rows.at(-1) || null;
  }
}

module.exports = { Vault };
