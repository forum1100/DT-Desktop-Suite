const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { stableHash } = require('./protocol.cjs');

class Vault {
  constructor(root) {
    this.root = root;
    this.log = path.join(root, 'events.jsonl');
    fs.mkdirSync(root, { recursive: true });
  }

  append(kind, agentId, data) {
    const previous = this.last();
    const entry = {
      id: crypto.randomUUID(), kind, agentId, data,
      createdAt: new Date().toISOString(),
      previousHash: previous?.hash || null
    };
    entry.hash = stableHash(entry);
    fs.appendFileSync(this.log, JSON.stringify(entry) + '\n', 'utf8');
    return entry;
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
