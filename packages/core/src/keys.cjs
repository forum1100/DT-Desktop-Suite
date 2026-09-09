const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

class KeyAuthority {
  constructor(root) {
    this.file = path.join(root, 'key-registry.json');
    fs.mkdirSync(root, { recursive: true });
  }
  load() { return fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')) : []; }
  save(rows) { fs.writeFileSync(this.file, JSON.stringify(rows, null, 2), 'utf8'); }
  issue({ label, scopes, expiresAt = null }) {
    const id = crypto.randomUUID();
    const secret = crypto.randomBytes(32).toString('base64url');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(secret, salt, 32).toString('hex');
    const record = { id, label, scopes, salt, hash, createdAt: new Date().toISOString(), expiresAt, revokedAt: null };
    const rows = this.load(); rows.push(record); this.save(rows);
    return { id, token: `dtk_${id}.${secret}`, scopes, expiresAt };
  }
  verify(token, requiredScope) {
    const match = /^dtk_([^.]+)\.(.+)$/.exec(token || '');
    if (!match) return null;
    const record = this.load().find(row => row.id === match[1]);
    if (!record || record.revokedAt || (record.expiresAt && Date.parse(record.expiresAt) <= Date.now())) return null;
    const hash = crypto.scryptSync(match[2], record.salt, 32).toString('hex');
    if (!crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(record.hash))) return null;
    return record.scopes.includes(requiredScope) ? record : null;
  }
  revoke(id) {
    const rows = this.load(); const row = rows.find(item => item.id === id);
    if (!row) return false; row.revokedAt = new Date().toISOString(); this.save(rows); return true;
  }
}
module.exports = { KeyAuthority };
