const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\bdtk_[A-Za-z0-9_.-]+\b/g,
  /\bdtr_[A-Za-z0-9_.-]+\b/g,
  /\b(?:api[_-]?key|token|password|secret)\s*[:=]\s*[^\s,;]+/gi
];

function redactSecrets(value) {
  if (typeof value === 'string') {
    return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, '[REDACTED_SECRET]'), value);
  }
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactSecrets(item)]));
  }
  return value;
}

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

class ExperienceLedger {
  constructor(root) {
    this.root = path.join(root, 'experience');
    this.file = path.join(this.root, 'events.jsonl');
    fs.mkdirSync(this.root, { recursive: true });
  }

  append(kind, data = {}, context = {}) {
    const localPayload = {
      schema: 'dt-experience/1.0', id: crypto.randomUUID(), kind,
      at: new Date().toISOString(), data, context
    };
    localPayload.hash = stableHash(localPayload);
    fs.appendFileSync(this.file, JSON.stringify(localPayload) + '\n', 'utf8');
    return {
      local: localPayload,
      externalSafe: redactSecrets(localPayload),
      externalSafeHash: stableHash(redactSecrets(localPayload))
    };
  }

  recent(limit = 200) {
    if (!fs.existsSync(this.file)) return [];
    const lines = fs.readFileSync(this.file, 'utf8').split(/\r?\n/).filter(Boolean);
    return lines.slice(-Math.max(1, limit)).map(line => JSON.parse(line));
  }
}

module.exports = { ExperienceLedger, redactSecrets, stableHash };
